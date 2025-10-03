from flask import Flask
from database import init_db

app = Flask(__name__)

# Run once at startup
init_db()
print("✅ Tables ensured.")

@app.route("/")
def home():
    return {"msg": "Flask + DB schema ready"}

if __name__ == "__main__":
    app.run(debug=True)
