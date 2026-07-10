
"""User shipping addresses blueprint (Phase 2).

CRUD, all user-scoped and ownership-guarded. Raw psycopg2 + RealDictCursor,
per-request connection, strict_slashes=False to match siblings.
"""
from flask import Blueprint, request, jsonify
from auth_middleware import token_required
from database import get_connection

addresses_bp = Blueprint("addresses", __name__)

_FIELDS = ("label", "line1", "line2", "city", "postal_code", "country", "phone")


@addresses_bp.route("/", methods=["POST"], strict_slashes=False)
@token_required
def create_address(user):
    data = request.get_json() or {}
    if not data.get("line1"):
        return jsonify({"error": "line1 required"}), 400

    is_default = bool(data.get("is_default", False))
    conn = get_connection()
    cur = conn.cursor()
    try:
        if is_default:
            cur.execute("UPDATE addresses SET is_default = false WHERE user_id = %s",
                        (user["id"],))
        cur.execute(
            "INSERT INTO addresses (user_id, label, line1, line2, city, postal_code, "
            "country, phone, is_default) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (user["id"], data.get("label"), data.get("line1"), data.get("line2"),
             data.get("city"), data.get("postal_code"), data.get("country"),
             data.get("phone"), is_default),
        )
        row = cur.fetchone()
        conn.commit()
        return jsonify(row), 201
    finally:
        cur.close()
        conn.close()


@addresses_bp.route("/", methods=["GET"], strict_slashes=False)
@token_required
def list_addresses(user):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT * FROM addresses WHERE user_id = %s ORDER BY is_default DESC, created_at DESC",
            (user["id"],),
        )
        return jsonify({"addresses": cur.fetchall()}), 200
    finally:
        cur.close()
        conn.close()


@addresses_bp.route("/<int:address_id>", methods=["GET"], strict_slashes=False)
@token_required
def get_address(user, address_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM addresses WHERE id = %s AND user_id = %s",
                    (address_id, user["id"]))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "address not found"}), 404
        return jsonify(row), 200
    finally:
        cur.close()
        conn.close()


@addresses_bp.route("/<int:address_id>", methods=["PUT"], strict_slashes=False)
@token_required
def update_address(user, address_id):
    data = request.get_json() or {}
    sets, values = [], []
    for f in _FIELDS:
        if f in data:
            sets.append(f"{f} = %s")
            values.append(data[f])
    if "is_default" in data:
        sets.append("is_default = %s")
        values.append(bool(data["is_default"]))
    if not sets:
        return jsonify({"error": "no fields to update"}), 400

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT id FROM addresses WHERE id = %s AND user_id = %s",
                    (address_id, user["id"]))
        if not cur.fetchone():
            return jsonify({"error": "address not found"}), 404
        if data.get("is_default"):
            cur.execute("UPDATE addresses SET is_default = false WHERE user_id = %s",
                        (user["id"],))
        values.extend([address_id, user["id"]])
        cur.execute(
            f"UPDATE addresses SET {', '.join(sets)} WHERE id = %s AND user_id = %s RETURNING *",
            tuple(values),
        )
        row = cur.fetchone()
        conn.commit()
        return jsonify(row), 200
    finally:
        cur.close()
        conn.close()


@addresses_bp.route("/<int:address_id>", methods=["DELETE"], strict_slashes=False)
@token_required
def delete_address(user, address_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM addresses WHERE id = %s AND user_id = %s RETURNING id",
                    (address_id, user["id"]))
        row = cur.fetchone()
        conn.commit()
        if not row:
            return jsonify({"error": "address not found"}), 404
        return jsonify({"deleted": address_id}), 200
    finally:
        cur.close()
        conn.close()
