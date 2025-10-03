from flask import Blueprint, request, jsonify
from database import get_connection
import bcrypt

users_bp = Blueprint("users", __name__)

@users_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        email = data.get("email")
        username = data.get("username")
        password = data.get("password")

        if not email or not username or not password:
            return jsonify({"error": "Missing required fields"}), 400

        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO users (email, password_hash, username)
            VALUES (%s, %s, %s)
            RETURNING id, email, username, created_at
        """, (email, password_hash, username))

        new_user = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "id": new_user["id"],
            "email": new_user["email"],
            "username": new_user["username"],
            "created_at": new_user["created_at"]
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
