from functools import wraps
from flask import request, jsonify, current_app
import jwt
from database import get_connection


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # JWT usually passed in header
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]  # "Bearer <token>"

        if not token:
            return jsonify({"error": "Token is missing!"}), 401

        try:
            data = jwt.decode(token, current_app.config["SECRET_KEY"], algorithms=["HS256"])
            user_id = data["user_id"]

            conn = get_connection()
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            cur.close()
            conn.close()

            if not user:
                return jsonify({"error": "User not found"}), 404

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        # attach user info to request for downstream use
        return f(user, *args, **kwargs)

    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(user, *args, **kwargs):
        if user["role"] != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(user, *args, **kwargs)
    return decorated
