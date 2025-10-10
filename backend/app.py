from flask import Flask
from flask_cors import CORS
from database import init_db
from routes.users import users_bp
from dotenv import load_dotenv
import os

load_dotenv()
print("SECRET_KEY:", os.getenv("SECRET_KEY"))
app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

CORS(app, resources={r"/*": {"origins": "*"}})  

init_db()
print("✅ Tables ensured.")

app.register_blueprint(users_bp, url_prefix="/users")

@app.route("/")
def home():
    return {"msg": "Flask + DB schema ready"}

if __name__ == "__main__":
    app.run(debug=True)
