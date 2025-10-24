from flask import Blueprint, request, jsonify, current_app
from database import get_connection
from auth_middleware import token_required

cart_bp = Blueprint("carts", __name__)

# --- Get current user's cart ---
@cart_bp.route("/", methods=["GET"])
@token_required
def get_cart(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # get or create cart
        cur.execute("SELECT id FROM carts WHERE user_id = %s", (user["id"],))
        cart = cur.fetchone()

        if not cart:
            cur.execute("INSERT INTO carts (user_id) VALUES (%s) RETURNING id;", (user["id"],))
            cart_id = cur.fetchone()["id"]  
            conn.commit()
        else:
            cart_id = cart["id"]

        # fetch items
        cur.execute("""
            SELECT ci.id, p.name, ci.product_id, p.price, ci.quantity, (p.price * ci.quantity) AS total
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = %s
        """, (cart_id,))
        items = cur.fetchall()

        cart_items = [
    {
        "item_id": row["id"],
        "product_name": row["name"],
        "product_id": row["product_id"],
        "price": float(row["price"]),
        "quantity": row["quantity"],
        "total": float(row["total"])
    }
    for row in items
]

        total_price = sum(item["total"] for item in cart_items)

        cur.close()
        conn.close()

        return jsonify({
            "cart_id": cart_id,
            "items": cart_items,
            "total_price": total_price
        }), 200

    except Exception as e:
        
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500



# --- Add product to cart ---
@cart_bp.route("/add", methods=["POST"])
@token_required
def add_to_cart(user):
    try:
        data = request.get_json()
        product_id = data.get("product_id")
        quantity = int(data.get("quantity", 1))

        conn = get_connection()
        cur = conn.cursor()

        # Ensure user has a cart
        cur.execute("SELECT id FROM carts WHERE user_id = %s", (user["id"],))
        cart = cur.fetchone()
        if not cart:
            cur.execute("INSERT INTO carts (user_id) VALUES (%s) RETURNING id;", (user["id"],))
            cart_id = cur.fetchone()["id"]
        else:
            cart_id = cart["id"]

        # ✅ Check if product already exists in user's cart
        cur.execute("SELECT quantity FROM cart_items WHERE cart_id = %s AND product_id = %s", (cart_id, product_id))
        existing_item = cur.fetchone()

        if existing_item:
            # Update quantity if product already exists
            new_quantity = existing_item["quantity"] + quantity
            cur.execute("""
                UPDATE cart_items
                SET quantity = %s
                WHERE cart_id = %s AND product_id = %s
            """, (new_quantity, cart_id, product_id))
        else:
            # Add new item if it doesn't exist
            cur.execute("""
                INSERT INTO cart_items (cart_id, product_id, quantity)
                VALUES (%s, %s, %s)
            """, (cart_id, product_id, quantity))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Product added to cart"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# --- Update quantity ---
@cart_bp.route("/update/<int:product_id>", methods=["PUT"])
@token_required
def update_quantity(user, product_id):
    try:
        data = request.get_json()
        quantity = int(data.get("quantity", 1))

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE cart_items
            SET quantity = %s
            WHERE product_id = %s AND cart_id = (SELECT id FROM carts WHERE user_id = %s)
        """, (quantity, product_id, user["id"]))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Quantity updated"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Remove product ---
@cart_bp.route("/remove/<int:product_id>", methods=["DELETE"])
@token_required
def remove_item(user, product_id):
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Check if item exists in user's cart
        cur.execute("""
            SELECT ci.id 
            FROM cart_items ci
            JOIN carts c ON ci.cart_id = c.id
            WHERE ci.product_id = %s AND c.user_id = %s
        """, (product_id, user["id"]))
        
        if not cur.fetchone():
            return jsonify({"error": "Item not found in cart"}), 404

        # Delete the item
        cur.execute("""
            DELETE FROM cart_items
            WHERE product_id = %s AND cart_id = (SELECT id FROM carts WHERE user_id = %s)
        """, (product_id, user["id"]))

        conn.commit()
        
        return jsonify({"message": "Product removed from cart"}), 200

    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": "Failed to remove item from cart"}), 500
    
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

# --- Clear cart ---
@cart_bp.route("/clear", methods=["DELETE"])
@token_required
def clear_cart(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            DELETE FROM cart_items
            WHERE cart_id = (SELECT id FROM carts WHERE user_id = %s)
        """, (user["id"],))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Cart cleared"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
