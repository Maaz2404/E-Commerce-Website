# routes/orders.py

from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required
from datetime import datetime

orders_bp = Blueprint("orders", __name__)

# 1️⃣ Create Order from Cart
@orders_bp.route("/create", methods=["POST"])
@token_required
def create_order(user):
    try:
        user_id = user["id"]
        conn = get_connection()
        cur = conn.cursor()

        # Get user cart
        cur.execute("SELECT id FROM carts WHERE user_id = %s", (user_id,))
        cart = cur.fetchone()
        if not cart:
            return jsonify({"error": "Cart not found"}), 404

        cart_id = cart["id"]

        # Get items from cart
        cur.execute("""
            SELECT ci.product_id, ci.quantity, p.price
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.cart_id = %s
        """, (cart_id,))
        items = cur.fetchall()

        if not items:
            return jsonify({"error": "Cart is empty"}), 400

        # Calculate total
        total_amount = sum(float(item["price"]) * item["quantity"] for item in items)

        # Create order
        cur.execute("""
            INSERT INTO orders (user_id, total_amount)
            VALUES (%s, %s)
            RETURNING id, status, created_at
        """, (user_id, total_amount))
        order = cur.fetchone()
        order_id = order["id"]

        # Insert order items
        for item in items:
            cur.execute("""
                INSERT INTO order_items (order_id, product_id, quantity, unit_price)
                VALUES (%s, %s, %s, %s)
            """, (order_id, item["product_id"], item["quantity"], float(item["price"])))

        # Clear the user's cart
        cur.execute("DELETE FROM cart_items WHERE cart_id = %s", (cart_id,))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Order created successfully",
            "order_id": order_id,
            "status": order["status"],
            "total_amount": total_amount,
            "created_at": order["created_at"]
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500


# 2️⃣ Get All Orders for Logged-In User
@orders_bp.route("/", methods=["GET"])
@token_required
def get_user_orders(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, total_amount, status, created_at, updated_at
            FROM orders WHERE user_id = %s
            ORDER BY created_at DESC
        """, (user["id"],))
        orders = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify(orders), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 3️⃣ Get Single Order (User Access)
@orders_bp.route("/<int:order_id>", methods=["GET"])
@token_required
def get_order_details(user, order_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # verify order belongs to user
        cur.execute("SELECT * FROM orders WHERE id = %s AND user_id = %s", (order_id, user["id"]))
        order = cur.fetchone()
        if not order:
            return jsonify({"error": "Order not found"}), 404

        cur.execute("""
            SELECT oi.id, p.name, oi.quantity, oi.unit_price, oi.subtotal
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = %s
        """, (order_id,))
        items = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({
            "order": order,
            "items": items
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 4️⃣ Update Order Status (Admin Only)
@orders_bp.route("/<int:order_id>/status", methods=["PATCH"])
@token_required
@admin_required
def update_order_status(user, order_id):
    try:
        data = request.get_json()
        new_status = data.get("status")

        if new_status not in ["pending", "shipped", "delivered", "cancelled"]:
            return jsonify({"error": "Invalid status"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE orders
            SET status = %s, updated_at = %s
            WHERE id = %s
            RETURNING id, status, updated_at
        """, (new_status, datetime.utcnow(), order_id))
        updated = cur.fetchone()

        if not updated:
            return jsonify({"error": "Order not found"}), 404

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Order status updated",
            "order": updated
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500


# 5️⃣ Admin View: Get All Orders
@orders_bp.route("/all", methods=["GET"])
@token_required
@admin_required
def get_all_orders(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT o.id, u.username, o.total_amount, o.status, o.created_at
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        """)
        orders = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify(orders), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
