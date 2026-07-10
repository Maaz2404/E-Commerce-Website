
from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required
from datetime import datetime
from utils.place_order import create_order_for_user,validate_coupon

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



# 1️⃣.5 Provision a dummy pre-funded test payment method (dev/test only)
# Since there is no real payment gateway yet, this gives the user a wallet
# with a large balance so any test checkout succeeds. Idempotent: if the user
# already has a dummy method it is returned as-is instead of creating another.
DUMMY_METHOD_TYPE = "dummy"
DUMMY_METHOD_BALANCE = 1_000_000  # PKR — fits NUMERIC(10,2)


@payments_bp.route("/methods/dummy", methods=["POST"])
@token_required
def add_dummy_payment_method(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # reuse an existing dummy method if present
        cur.execute("""
            SELECT id, method_type, balance, created_at
            FROM payment_methods
            WHERE user_id = %s AND method_type = %s
            ORDER BY id
            LIMIT 1
        """, (user["id"], DUMMY_METHOD_TYPE))
        existing = cur.fetchone()

        if existing:
            cur.close()
            conn.close()
            return jsonify({
                "message": "Dummy payment method already exists",
                "method": existing
            }), 200

        cur.execute("""
            INSERT INTO payment_methods (user_id, method_type, balance)
            VALUES (%s, %s, %s)
            RETURNING id, method_type, balance, created_at
        """, (user["id"], DUMMY_METHOD_TYPE, DUMMY_METHOD_BALANCE))

        new_method = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Dummy payment method added",
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



@payments_bp.route("/pay", methods=["POST"])
@token_required
def make_payment(user):
    try:
        data = request.get_json()
        method_id = data.get("payment_method_id")
        coupon_code = data.get("coupon_code")  # optional

        if not method_id:
            return jsonify({"error": "payment_method_id required"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # 1️⃣ Get payment method
        cur.execute("""
            SELECT id, balance
            FROM payment_methods
            WHERE id = %s AND user_id = %s
        """, (method_id, user["id"]))
        method = cur.fetchone()

        if not method:
            return jsonify({"error": "Payment method not found"}), 404

        try:
            # 2️⃣ Build order using helper
            order_data = create_order_for_user(
                user_id=user["id"],
                cur=cur,
                conn=conn,
                coupon_code=coupon_code,
                validate_coupon_fn=validate_coupon
            )

            order_id = order_data["order_id"]
            items = order_data["items"]
            total_amount = float(order_data["total_amount"])
            discount_amount = float(order_data.get("discount_amount", 0))
            coupon_id = order_data.get("coupon_id")

            final_amount = total_amount

            # 3️⃣ Check payment balance
            if method["balance"] < final_amount:
                raise Exception("Insufficient balance")

            # 4️⃣ Deduct balance
            cur.execute("""
                UPDATE payment_methods
                SET balance = balance - %s, updated_at = NOW()
                WHERE id = %s
            """, (final_amount, method_id))

            # 5️⃣ Update stock
            for item in items:
                cur.execute("""
                    UPDATE products
                    SET stock = stock - %s
                    WHERE id = %s AND stock >= %s
                    RETURNING id
                """, (item["quantity"], item["product_id"], item["quantity"]))

                if not cur.fetchone():
                    raise Exception(f"Insufficient stock for product {item['product_id']}")

            # 6️⃣ Record payment
            cur.execute("""
                INSERT INTO payments (order_id, payment_method_id, amount, status)
                VALUES (%s, %s, %s, 'success')
                RETURNING id, amount, status, created_at
            """, (order_id, method_id, final_amount))
            payment = cur.fetchone()

            # 7️⃣ Mark order as paid
            cur.execute("""
                UPDATE orders
                SET status = 'paid', updated_at = NOW()
                WHERE id = %s
            """, (order_id,))

            # 8️⃣ Record coupon redemption
            if coupon_id:
                cur.execute("""
                    INSERT INTO coupon_redemptions
                        (coupon_id, user_id, order_id, discount_applied)
                    VALUES (%s, %s, %s, %s)
                """, (coupon_id, user["id"], order_id, discount_amount))

                # decrement uses_left
                cur.execute("""
                    UPDATE coupons
                    SET uses_left = uses_left - 1
                    WHERE id = %s
                """, (coupon_id,))

            conn.commit()
            cur.close()
            conn.close()

            return jsonify({
                "message": "Payment successful",
                "order_id": order_id,
                "payment": payment,
                "total_before_discount": total_amount,
                "discount_applied": discount_amount,
                "final_amount": final_amount,
                "coupon_applied": bool(coupon_id),
            }), 201

        except Exception as e:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": str(e)}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500



# 5️⃣.5 Get Payment Status (read-only, user-scoped) — Phase 1
@payments_bp.route("/<int:payment_id>/status", methods=["GET"])
@token_required
def get_payment_status(user, payment_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # scope to the caller by joining through orders.user_id — a payment on
        # someone else's order must 404, not leak.
        cur.execute("""
            SELECT p.id, p.order_id, p.amount, p.status, p.created_at,
                   p.payment_method_id
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE p.id = %s AND o.user_id = %s
        """, (payment_id, user["id"]))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Payment not found"}), 404
        return jsonify(row), 200
    finally:
        cur.close()
        conn.close()


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
