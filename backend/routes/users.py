from flask import Blueprint, request, jsonify,current_app
from database import get_connection
import bcrypt
from auth_middleware import token_required,admin_required
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
        cur.execute(
        "INSERT INTO carts (user_id) VALUES (%s)", 
        (new_user["id"],)
)
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
            "role": user["role"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }
        
        token = jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")

        return jsonify({
            "message": "Login successful",
            "token": token
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# Phase 2: current-user profile + demo password reset
# ---------------------------------------------------------
@users_bp.route("/me", methods=["GET"], strict_slashes=False)
@token_required
def get_me(user):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT id, email, username, role, created_at FROM users WHERE id = %s",
            (user["id"],),
        )
        return jsonify(cur.fetchone()), 200
    finally:
        cur.close()
        conn.close()


@users_bp.route("/me", methods=["PUT", "PATCH"], strict_slashes=False)
@token_required
def update_me(user):
    data = request.get_json() or {}
    # allow updating profile fields the user owns
    allowed = {"username": "username = %s", "email": "email = %s"}
    sets, values = [], []
    for key, sql in allowed.items():
        if key in data and data[key]:
            sets.append(sql)
            values.append(data[key])
    if not sets:
        return jsonify({"error": "no updatable fields provided"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        values.append(user["id"])
        cur.execute(
            f"UPDATE users SET {', '.join(sets)} WHERE id = %s "
            f"RETURNING id, email, username, role, created_at",
            tuple(values),
        )
        updated = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Profile updated", "user": updated}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        cur.close()
        conn.close()


@users_bp.route("/password-reset", methods=["POST"], strict_slashes=False)
@token_required
def request_password_reset(user):
    """Demo password reset: no email infra — a token row is inserted and the
    token is returned/logged so the flow is testable end-to-end."""
    import secrets
    import datetime as _dt

    token = secrets.token_hex(16)
    expires = _dt.datetime.utcnow() + _dt.timedelta(hours=1)
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) "
            "VALUES (%s, %s, %s) RETURNING id, token, expires_at",
            (user["id"], token, expires),
        )
        row = cur.fetchone()
        conn.commit()
        print(f"🔑 [demo] password reset token for user {user['id']}: {token}")
        return jsonify({
            "message": "Password reset initiated. Use this token to reset your password (demo — no email sent).",
            "reset_token": row["token"],
            "expires_at": row["expires_at"],
        }), 201
    finally:
        cur.close()
        conn.close()


@users_bp.route("/all-users", methods=["GET"])
@token_required
@admin_required
def get_all_normal_users(admin):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, email, username, role, created_at
            FROM users
            WHERE role = 'user'
            ORDER BY created_at DESC
        """)

        users = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({
            "users": users
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
