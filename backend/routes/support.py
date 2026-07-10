from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required
from datetime import datetime

support_bp = Blueprint("support", __name__)

# 1️⃣ Send message (user)
@support_bp.route("/send", methods=["POST"])
@token_required
def send_message(user):
    try:
        data = request.get_json()
        message = data.get("message")

        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO support_messages (user_id, sender_type, message, is_read, created_at)
            VALUES (%s, 'user', %s, FALSE, NOW())
            RETURNING id, message, is_read, created_at
        """, (user["id"], message))
        msg = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Message sent", "data": msg}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 2️⃣ Reply to user (admin)
@support_bp.route("/reply/<int:user_id>", methods=["POST"])
@token_required
@admin_required
def reply_to_user(admin, user_id):
    try:
        data = request.get_json()
        message = data.get("message")

        if not message:
            return jsonify({"error": "Message cannot be empty"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # check if user exists
        cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cur.fetchone():
            return jsonify({"error": "User not found"}), 404

        cur.execute("""
            INSERT INTO support_messages (user_id, sender_type, message, is_read, created_at)
            VALUES (%s, 'admin', %s, FALSE, NOW())
            RETURNING id, message, is_read, created_at
        """, (user_id, message))
        msg = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Reply sent", "data": msg}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 3️⃣ Fetch all messages (user)
@support_bp.route("/messages", methods=["GET"])
@token_required
def fetch_user_messages(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, sender_type, message, is_read, created_at
            FROM support_messages
            WHERE user_id = %s
            ORDER BY created_at ASC
        """, (user["id"],))
        messages = cur.fetchall()

        # mark all admin messages as read
        cur.execute("""
            UPDATE support_messages
            SET is_read = TRUE
            WHERE user_id = %s AND sender_type = 'admin' AND is_read = FALSE
        """, (user["id"],))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"messages": messages}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 4️⃣ Fetch messages for a specific user (admin)
@support_bp.route("/messages/<int:user_id>", methods=["GET"])
@token_required
@admin_required
def fetch_user_chat(admin, user_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, sender_type, message, is_read, created_at
            FROM support_messages
            WHERE user_id = %s
            ORDER BY created_at ASC
        """, (user_id,))
        messages = cur.fetchall()

        # mark all user messages as read (admin has now seen them)
        cur.execute("""
            UPDATE support_messages
            SET is_read = TRUE
            WHERE user_id = %s AND sender_type = 'user' AND is_read = FALSE
        """, (user_id,))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"messages": messages}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# get unread msg count for all users
@support_bp.route("/messages/unread-counts", methods=["GET"])
@token_required
@admin_required
def unread_counts(admin):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT user_id, COUNT(*) AS unread
            FROM support_messages
            WHERE sender_type = 'user' AND is_read = FALSE
            GROUP BY user_id
        """)

        rows = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({"counts": rows}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 7️⃣ Fetch messages for a specific user (admin) and mark them as read
@support_bp.route("/messages/user/<int:user_id>", methods=["GET"])
@token_required
@admin_required
def fetch_specific_user_messages(admin, user_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # fetch all messages for this user (both user & admin messages)
        cur.execute("""
            SELECT id AS message_id, sender_type, message, is_read, created_at
            FROM support_messages
            WHERE user_id = %s
            ORDER BY created_at ASC
        """, (user_id,))
        messages = cur.fetchall()

        # mark all user messages as read
        cur.execute("""
            UPDATE support_messages
            SET is_read = TRUE
            WHERE user_id = %s AND sender_type = 'user' AND is_read = FALSE
        """, (user_id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"messages": messages}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
