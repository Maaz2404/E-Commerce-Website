
from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required
from datetime import datetime

payments_bp = Blueprint("payments", __name__)


# 1️⃣ Add Payment Method (wallet/card)
@payments_bp.route("/methods/add", methods=["POST"])
@token_required
def add_payment_method(user):
    try:
        data = request.get_json()
        method_type = data.get("method_type")
        balance = data.get("balance", 0)

        if not method_type:
            return jsonify({"error": "method_type is required"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO payment_methods (user_id, method_type, balance)
            VALUES (%s, %s, %s)
            RETURNING id, method_type, balance, created_at
        """, (user["id"], method_type, balance))

        new_method = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Payment method added",
            "method": new_method
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 2️⃣ Get User Payment Methods
@payments_bp.route("/methods", methods=["GET"])
@token_required
def get_payment_methods(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, method_type, balance, created_at, updated_at
            FROM payment_methods
            WHERE user_id = %s
        """, (user["id"],))

        methods = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify({"methods": methods}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 3️⃣ Top-up Payment Method
@payments_bp.route("/methods/<int:method_id>/topup", methods=["PATCH"])
@token_required
def topup_method(user, method_id):
    try:
        data = request.get_json()
        amount = data.get("amount")

        if amount is None or float(amount) <= 0:
            return jsonify({"error": "Invalid amount"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE payment_methods
            SET balance = balance + %s, updated_at = NOW()
            WHERE id = %s AND user_id = %s
            RETURNING id, method_type, balance
        """, (amount, method_id, user["id"]))

        updated = cur.fetchone()
        if not updated:
            return jsonify({"error": "Payment method not found"}), 404

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Balance updated",
            "method": updated
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 4️⃣ Delete Payment Method
@payments_bp.route("/methods/<int:method_id>", methods=["DELETE"])
@token_required
def delete_payment_method(user, method_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            DELETE FROM payment_methods
            WHERE id = %s AND user_id = %s
            RETURNING id
        """, (method_id, user["id"]))

        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({"error": "Payment method not found"}), 404

        return jsonify({"message": "Payment method deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 5️⃣ Make Payment for an Order
@payments_bp.route("/pay/<int:order_id>", methods=["POST"])
@token_required
def make_payment(user, order_id):
    try:
        data = request.get_json()
        method_id = data.get("payment_method_id")

        if not method_id:
            return jsonify({"error": "payment_method_id required"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # Get order
        cur.execute("""
            SELECT id, user_id, total_amount, status
            FROM orders
            WHERE id = %s AND user_id = %s
        """, (order_id, user["id"]))
        order = cur.fetchone()

        if not order:
            return jsonify({"error": "Order not found"}), 404

        if order["status"] == "paid":
            return jsonify({"error": "Order already paid"}), 400

        total = float(order["total_amount"])

        # Get payment method
        cur.execute("""
            SELECT id, balance
            FROM payment_methods
            WHERE id = %s AND user_id = %s
        """, (method_id, user["id"]))
        method = cur.fetchone()

        if not method:
            return jsonify({"error": "Payment method not found"}), 404

        if method["balance"] < total:
            return jsonify({"error": "Insufficient balance"}), 400

        # Deduct balance
        cur.execute("""
            UPDATE payment_methods
            SET balance = balance - %s, updated_at = NOW()
            WHERE id = %s
        """, (total, method_id))

        # Check and decrement stock for all order items
        cur.execute("""
            SELECT product_id, quantity
            FROM order_items
            WHERE order_id = %s
        """, (order_id,))
        items = cur.fetchall()

        for item in items:
            cur.execute("""
                UPDATE products
                SET stock = stock - %s
                WHERE id = %s AND stock >= %s
                RETURNING id
            """, (item["quantity"], item["product_id"], item["quantity"]))
            if not cur.fetchone():
                conn.rollback()
                return jsonify({"error": f"Insufficient stock for product {item['product_id']}"}), 400

        # Record payment
        cur.execute("""
            INSERT INTO payments (order_id, payment_method_id, amount, status)
            VALUES (%s, %s, %s, 'success')
            RETURNING id, amount, status, created_at
        """, (order_id, method_id, total))
        payment = cur.fetchone()

        # Update order status
        cur.execute("""
            UPDATE orders
            SET status = 'paid', updated_at = NOW()
            WHERE id = %s
        """, (order_id,))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Payment successful",
            "payment": payment
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500


# 6️⃣ Change Payment Status (Admin Only)
@payments_bp.route("/<int:payment_id>/status", methods=["PATCH"])
@token_required
@admin_required
def change_payment_status(user, payment_id):
    try:
        data = request.get_json()
        new_status = data.get("status")

        if new_status not in ["success", "failed", "refunded"]:
            return jsonify({"error": "Invalid status"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE payments
            SET status = %s
            WHERE id = %s
            RETURNING id, status
        """, (new_status, payment_id))

        updated = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if not updated:
            return jsonify({"error": "Payment not found"}), 404

        return jsonify({
            "message": "Payment status updated",
            "payment": updated
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 7️⃣ Refund (Admin)
@payments_bp.route("/refund/<int:payment_id>", methods=["POST"])
@token_required
@admin_required
def refund_payment(user, payment_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # get payment
        cur.execute("""
            SELECT id, amount, payment_method_id, status
            FROM payments
            WHERE id = %s
        """, (payment_id,))
        payment = cur.fetchone()

        if not payment:
            return jsonify({"error": "Payment not found"}), 404

        if payment["status"] == "refunded":
            return jsonify({"error": "Already refunded"}), 400

        amount = float(payment["amount"])

        # add balance back
        cur.execute("""
            UPDATE payment_methods
            SET balance = balance + %s
            WHERE id = %s
        """, (amount, payment["payment_method_id"]))

        # update payment status
        cur.execute("""
            UPDATE payments
            SET status = 'refunded'
            WHERE id = %s
            RETURNING id, status
        """, (payment_id,))

        updated = cur.fetchone()
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Refund processed",
            "payment": updated
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
