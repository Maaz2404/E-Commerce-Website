from flask import Flask
from flask_cors import CORS
from database import init_db
from routes.users import users_bp
from routes.products import products_bp
from routes.carts import cart_bp
from routes.orders import orders_bp

from dotenv import load_dotenv
import os

load_dotenv()
print("SECRET_KEY:", os.getenv("SECRET_KEY"))
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

CORS(
    app,
    resources={r"/*": {
        # 1. Be specific with your origin. Browsers block '*'
        #    when 'Authorization' headers are used.
        "origins": "*",
        
        # 2. Add "DELETE" and "OPTIONS"
        "methods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        
        # 3. This is the most important part you're missing
        "allow_headers": ["Content-Type", "Authorization"]
    }}
)

init_db()
print("✅ Tables ensured.")

app.register_blueprint(users_bp, url_prefix="/users")
app.register_blueprint(products_bp, url_prefix="/products")
app.register_blueprint(cart_bp,url_prefix="/carts")
app.register_blueprint(orders_bp,url_prefix="/orders")


@app.route("/")
def home():
    return {"msg": "Flask + DB schema ready"}

if __name__ == "__main__":
    app.run(debug=True)
