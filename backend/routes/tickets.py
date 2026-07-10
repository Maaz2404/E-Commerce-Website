"""Support tickets blueprint (Phase 2).

Multipart create → optional file saved under backend/uploads/ (demo-grade local
disk, matching the internal-wallet simplicity of the rest of the app). The JSON
create path (no file) is used by the escalation flow; the multipart path is what
the widget's image-upload uses (damaged-item photo, story 8).
"""
import os
import uuid

from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

from auth_middleware import token_required
from database import get_connection

tickets_bp = Blueprint("tickets", __name__)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))


@tickets_bp.route("/", methods=["POST"], strict_slashes=False)
@token_required
def create_ticket(user):
    # Accept both multipart (with optional file) and plain form fields.
    subject = request.form.get("subject") or (request.get_json(silent=True) or {}).get("subject")
    category = request.form.get("category") or (request.get_json(silent=True) or {}).get("category") or "other"
    chat_id = request.form.get("chat_id") or (request.get_json(silent=True) or {}).get("chat_id") or None

    if not subject:
        return jsonify({"error": "subject required"}), 400

    path = None
    file = request.files.get("attachment")
    if file and file.filename:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        fname = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
        file.save(os.path.join(UPLOAD_DIR, fname))
        path = f"uploads/{fname}"

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO tickets (user_id, chat_id, subject, category, attachment_path) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING *",
            (user["id"], chat_id, subject, category, path),
        )
        row = cur.fetchone()
        conn.commit()
        return jsonify(row), 201
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/", methods=["GET"], strict_slashes=False)
@token_required
def list_tickets(user):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM tickets WHERE user_id = %s ORDER BY created_at DESC",
            (user["id"],),
        )
        return jsonify({"tickets": cur.fetchall()}), 200
    finally:
        cur.close()
        conn.close()


@tickets_bp.route("/uploads/<path:name>", methods=["GET"])
def serve_upload(name):
    """Serve an uploaded attachment file statically."""
    return send_from_directory(UPLOAD_DIR, name)
