from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required

support_bp = Blueprint("support", __name__)

@support_bp.route("/submit", methods=["POST"])
@token_required
def submit_ticket(current_user):
    try:
        data = request.get_json()
        subject = data.get("subject")
        message = data.get("message")

        if not subject or not message:
            return jsonify({"error": "Subject and message are required"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO support_tickets (user_id, subject, message)
            VALUES (%s, %s, %s)
            RETURNING id, subject, message, status, created_at
        """, (current_user["id"], subject, message))

        ticket = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "id": ticket["id"],
            "subject": ticket["subject"],
            "message": ticket["message"],
            "status": ticket["status"],
            "created_at": ticket["created_at"]
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@support_bp.route("/admin/tickets", methods=["GET"])
@admin_required
def get_all_tickets(current_user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT st.id, st.subject, st.message, st.status, st.created_at, st.updated_at,
                   u.username, u.email
            FROM support_tickets st
            JOIN users u ON st.user_id = u.id
            ORDER BY st.created_at DESC
        """)

        tickets = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([dict(ticket) for ticket in tickets]), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@support_bp.route("/admin/<int:ticket_id>", methods=["PUT"])
@admin_required
def update_ticket_status(current_user, ticket_id):
    try:
        data = request.get_json()
        new_status = data.get("status")

        if new_status not in ["open", "closed", "resolved"]:
            return jsonify({"error": "Invalid status. Must be 'open', 'closed', or 'resolved'"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE support_tickets
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, subject, message, status, created_at, updated_at
        """, (new_status, ticket_id))

        ticket = cur.fetchone()
        if not ticket:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Ticket not found"}), 404

        conn.commit()
        cur.close()
        conn.close()

        return jsonify(dict(ticket)), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@support_bp.route("/tickets", methods=["GET"])
@token_required
def get_tickets(current_user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, subject, message, status, created_at, updated_at
            FROM support_tickets
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (current_user["id"],))

        tickets = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([dict(ticket) for ticket in tickets]), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
