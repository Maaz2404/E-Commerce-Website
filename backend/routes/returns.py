"""Returns / exchanges blueprint (Phase 2).

User-scoped and ownership-guarded: a return can only be filed against an order
the caller owns, and a foreign return id 404s rather than leaking another user's
row. Raw psycopg2 + RealDictCursor + per-request connection, matching siblings.
"""
from flask import Blueprint, request, jsonify
from auth_middleware import token_required
from database import get_connection

returns_bp = Blueprint("returns", __name__)


@returns_bp.route("/", methods=["POST"], strict_slashes=False)
@token_required
def create_return(user):
    data = request.get_json() or {}
    order_id = data.get("order_id")
    rtype = data.get("type", "return")          # 'return' | 'exchange'
    reason = data.get("reason")

    if not order_id:
        return jsonify({"error": "order_id required"}), 400
    if rtype not in ("return", "exchange"):
        return jsonify({"error": "type must be 'return' or 'exchange'"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        # ownership guard — the order must belong to this user
        cur.execute("SELECT id FROM orders WHERE id = %s AND user_id = %s",
                    (order_id, user["id"]))
        if not cur.fetchone():
            return jsonify({"error": "order not found"}), 404

        cur.execute(
            "INSERT INTO returns (order_id, user_id, type, reason) "
            "VALUES (%s, %s, %s, %s) RETURNING *",
            (order_id, user["id"], rtype, reason),
        )
        row = cur.fetchone()
        conn.commit()
        return jsonify(row), 201
    finally:
        cur.close()
        conn.close()


@returns_bp.route("/", methods=["GET"], strict_slashes=False)
@token_required
def list_returns(user):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM returns WHERE user_id = %s ORDER BY created_at DESC",
            (user["id"],),
        )
        return jsonify({"returns": cur.fetchall()}), 200
    finally:
        cur.close()
        conn.close()


@returns_bp.route("/<int:return_id>", methods=["GET"], strict_slashes=False)
@token_required
def get_return(user, return_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM returns WHERE id = %s AND user_id = %s",
            (return_id, user["id"]),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "return not found"}), 404
        return jsonify(row), 200
    finally:
        cur.close()
        conn.close()
