from flask import Flask
from flask_cors import CORS
from database import init_db
from migrate import run_migrations
from routes.users import users_bp
from routes.products import products_bp
from routes.carts import cart_bp
from routes.orders import orders_bp
from routes.payments import payments_bp
from routes.coupons import coupons_bp
from routes.reviews import reviews_bp
from routes.support import support_bp
from routes.stats import stats_bp
from routes.chat import chat_bp
from routes.returns import returns_bp
from routes.tickets import tickets_bp
from routes.addresses import addresses_bp



import gunicorn

from dotenv import load_dotenv
import os

load_dotenv()
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

# Run migrations to ensure schema is up-to-date
print("🔄 Running database migrations...")
run_migrations()
print("✅ Migrations completed.")

CORS(
    app,
    resources={r"/*": {
        # 1. Be specific with your origin. Browsers block '*'
        #    when 'Authorization' headers are used.
        "origins": ["http://localhost:3000",
                    "https://congenial-disco-5gqgjrqj4wpgf6xv-3000.app.github.dev",
                    "https://e-commerce-website-d8c6.vercel.app"],
        
        # 2. Add "DELETE" and "OPTIONS"
        "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        
        # 3. This is the most important part you're missing
        "allow_headers": ["Content-Type", "Authorization"]
    }},
     supports_credentials=True
)

init_db()
print("✅ Tables ensured.")

# Chatbot Phase 2: ensure the LangGraph Postgres checkpointer tables exist
# (idempotent). These back the HITL interrupt()/resume pause-and-continue flow.
def _setup_checkpointer():
    import asyncio
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    async def _run():
        async with AsyncPostgresSaver.from_conn_string(os.environ["DATABASE_URL"]) as saver:
            await saver.setup()

    asyncio.run(_run())

try:
    _setup_checkpointer()
    print("✅ LangGraph checkpointer ready.")
except Exception as e:
    print(f"⚠️  Checkpointer setup skipped: {e}")

app.register_blueprint(users_bp, url_prefix="/users")
app.register_blueprint(products_bp, url_prefix="/products")
app.register_blueprint(cart_bp,url_prefix="/carts")
app.register_blueprint(orders_bp,url_prefix="/orders")
app.register_blueprint(payments_bp,url_prefix="/payments")
app.register_blueprint(coupons_bp,url_prefix="/coupons")
app.register_blueprint(reviews_bp,url_prefix="/reviews")
app.register_blueprint(support_bp,url_prefix="/support")
app.register_blueprint(stats_bp, url_prefix="/stats")
app.register_blueprint(chat_bp, url_prefix="/chat")
app.register_blueprint(returns_bp, url_prefix="/returns")
app.register_blueprint(tickets_bp, url_prefix="/tickets")
app.register_blueprint(addresses_bp, url_prefix="/addresses")

@app.route("/")
def home():
    return {"msg": "Flask + DB schema ready"}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
