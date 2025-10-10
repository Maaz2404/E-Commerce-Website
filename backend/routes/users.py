from flask import Blueprint, request, jsonify,current_app
from database import get_connection
import bcrypt
import os


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
    
import jwt
import datetime
from flask import current_app

@users_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Missing email or password"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user:
            return jsonify({"error": "Invalid email or password"}), 401

        # Verify password
        if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
            return jsonify({"error": "Invalid email or password"}), 401

        # Create JWT token
        payload = {
            "user_id": user["id"],
            "username": user["username"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }
        
        token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")

        return jsonify({
            "message": "Login successful",
            "token": token
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
