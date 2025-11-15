import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection():
    """
    Returns a new database connection with dict-style cursor.
    Usage:
        conn = get_connection()
        cur = conn.cursor()
    """
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def init_db():
    """
    Ensures required tables exist.
    """
    commands = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            username VARCHAR(100) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            stock NUMBER NOT NULL,
            category VARCHAR(100),
            image_url TEXT
        )
        """,
        """
            CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
            CREATE TABLE IF NOT EXISTS order_items (
            id SERIAL PRIMARY KEY,
            order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            quantity INT NOT NULL CHECK (quantity > 0),
            unit_price DECIMAL(10,2) NOT NULL,
            subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
        )

        """,
        """
        CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
         )
        """,
        """
        CREATE TABLE IF NOT EXISTS cart_items (
            id SERIAL PRIMARY KEY,
            cart_id INT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
            product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            quantity INT NOT NULL CHECK (quantity > 0),
            added_at TIMESTAMP DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        method_type VARCHAR(50) NOT NULL,
        balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        )

        """,
        """
        CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id),

        amount NUMERIC(10,2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'success',        -- 'success', 'failed', etc.
        created_at TIMESTAMP DEFAULT NOW()
        )

        """,
    """
   
    CREATE TABLE IF NOT EXISTS coupons (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        discount_type VARCHAR(20) NOT NULL,       -- 'percentage' or 'flat'
        discount_value NUMERIC(10,2) NOT NULL,
        max_uses INT NOT NULL ,
        uses_left INT NOT NULL ,
        status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active' or 'expired'
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
        )
    """,
    """

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
        id SERIAL PRIMARY KEY,
        coupon_id INT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        discount_applied NUMERIC(10,2) NOT NULL,
        redeemed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (coupon_id, user_id)   -- ensures one redemption per user
        )

        """,
        """
        CREATE TABLE  IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,

        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),

        comment TEXT,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

        -- a user can review a product only once
        CREATE UNIQUE INDEX IF NOT EXISTS unique_user_review_per_product
        ON reviews (product_id, user_id);

        -- fast lookup for product ratings
        CREATE INDEX IF NOT EXISTS idx_reviews_product_id
        ON reviews (product_id);

        """,
        """
        CREATE TABLE IF NOT EXISTS support_messages (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- the user who owns this conversation
        sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user','admin')),  -- who sent the message
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,  -- unread by default
        created_at TIMESTAMP DEFAULT NOW()
        );

    -- Index for fast lookup per user
    CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages (user_id);

    -- Optional: index for unread messages for quick admin dashboard queries
    CREATE INDEX IF NOT EXISTS idx_support_messages_unread ON support_messages (user_id, is_read) WHERE is_read = FALSE;

        """
        
    ]

    with get_connection() as conn:
        with conn.cursor() as cur:
            for command in commands:
                cur.execute(command)
        conn.commit()
