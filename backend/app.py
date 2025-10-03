from flask import Flask
from database import init_db
from routes.users import users_bp

app = Flask(__name__)


init_db()
print("✅ Tables ensured.")

app.register_blueprint(users_bp, url_prefix="/users")

@app.route("/")
def home():
    return {"msg": "Flask + DB schema ready"}

if __name__ == "__main__":
    app.run(debug=True)
