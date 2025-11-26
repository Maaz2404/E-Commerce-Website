from utils.place_order import create_order_for_user,validate_coupon
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
        data = request.get_json() or {}
        coupon_id = data.get("coupon_id")  # Optional coupon
        user_id = user["id"]

        conn = get_connection()
        cur = conn.cursor()

        # Use helper to place order
        order_info = create_order_for_user(user_id, cur, conn, coupon_id=coupon_id,validate_coupon_fn=validate_coupon)

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Order created successfully",
            "order_id": order_info["order_id"],
            "total_amount": order_info["total_amount"],
            "items": order_info["items"]
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

@orders_bp.route("/<int:order_id>/refund", methods=["POST"])
@token_required
def refund_order(user, order_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # 1) Fetch order
        cur.execute("""
            SELECT id, user_id, total_amount, status
            FROM orders
            WHERE id = %s
        """, (order_id,))
        order = cur.fetchone()

        if not order:
            return jsonify({"error": "Order not found"}), 404

        order_id, owner_id, total_amount, status = order

        # 2) Check permission
        is_admin = user.get("role") == "admin"

        # User trying to refund someone else's order — block it
        if not is_admin and owner_id != user["id"]:
            return jsonify({"error": "Unauthorized"}), 403

        # User restrictions
        if not is_admin:
            # normal user can only refund if paid
            if status not in ["paid", "delivered"]:
                return jsonify({"error": "Order cannot be refunded in its current status"}), 400

        # Prevent double refund
        if status == "refunded":
            return jsonify({"error": "Order already refunded"}), 400

        # 3) Fetch payment method for user
        cur.execute("""
            SELECT id, balance
            FROM payment_methods
            WHERE user_id = %s
            ORDER BY id ASC
            LIMIT 1
        """, (owner_id,))
        payment_method = cur.fetchone()

        if not payment_method:
            return jsonify({"error": "User has no payment method to refund to"}), 400

        pay_method_id, old_balance = payment_method

        new_balance = old_balance + total_amount

        # 4) Update payment method balance
        cur.execute("""
            UPDATE payment_methods
            SET balance = %s
            WHERE id = %s
        """, (new_balance, pay_method_id))

        # 5) Update order status
        cur.execute("""
            UPDATE orders
            SET status = %s, updated_at = %s
            WHERE id = %s
        """, ("refunded", datetime.utcnow(), order_id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Order refunded",
            "refund_amount": total_amount,
            "refunded_to_payment_method": pay_method_id,
            "admin_override": is_admin
        }), 200

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
