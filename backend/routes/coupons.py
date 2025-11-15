from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required

coupons_bp = Blueprint("coupons", __name__)


@coupons_bp.route("/create", methods=["POST"])
@token_required
@admin_required
def create_coupon(user):
    try:
        # admin check
        if user.get("role") != "admin":
            return jsonify({"error": "Admin access only"}), 403

        data = request.get_json()

        code = data.get("code")
        discount_type = data.get("discount_type")  # 'flat' or 'percent'
        discount_value = data.get("discount_value")
        max_uses = data.get("max_uses", 1)

        # validations
        if not code:
            return jsonify({"error": "Coupon code required"}), 400
        if discount_type not in ["flat", "percent"]:
            return jsonify({"error": "discount_type must be 'flat' or 'percent'"}), 400
        if not discount_value or float(discount_value) <= 0:
            return jsonify({"error": "discount_value must be > 0"}), 400

        if int(max_uses) <= 0:
            return jsonify({"error": "max_uses must be > 0"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # check duplicate code
        cur.execute("SELECT 1 FROM coupons WHERE code = %s", (code,))
        if cur.fetchone():
            return jsonify({"error": "Coupon code already exists"}), 400

        # insert coupon
        cur.execute("""
            INSERT INTO coupons (code, discount_type, discount_value, max_uses, uses_left, status)
            VALUES (%s, %s, %s, %s, %s, 'active')
            RETURNING id, code, discount_type, discount_value, max_uses, uses_left, status, created_at
        """, (code, discount_type, discount_value, max_uses, max_uses))

        coupon = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Coupon created successfully",
            "coupon": coupon
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 1) GET ALL ACTIVE COUPONS (ADMIN ONLY)
# ---------------------------------------------------------
@coupons_bp.route("/active", methods=["GET"])
@token_required
@admin_required
def get_active_coupons(user):
    try:
        if user.get("role") != "admin":
            return jsonify({"error": "Admin access only"}), 403

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, code, discount_type, discount_value, max_uses, uses_left, status, created_at
            FROM coupons
            WHERE status = 'active'
        """)

        coupons = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({"active_coupons": coupons}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500




# ---------------------------------------------------------
# 2) UPDATE ANY COUPON (ADMIN ONLY)
# ---------------------------------------------------------
@coupons_bp.route("/update/<int:coupon_id>", methods=["PATCH"])
@token_required
@admin_required
def update_coupon(user, coupon_id):
    try:
        if user.get("role") != "admin":
            return jsonify({"error": "Admin access only"}), 403

        data = request.get_json()
        fields = []
        values = []

        allowed = {
            "code": "code = %s",
            "discount_type": "discount_type = %s",
            "discount_value": "discount_value = %s",
            "max_uses": "max_uses = %s",
            "status": "status = %s"
        }

        # validate fields
        for key in data:
            if key not in allowed:
                return jsonify({"error": f"Invalid field: {key}"}), 400

        # prepare updates
        for key, sql in allowed.items():
            if key in data and data[key] is not None:
                # validations
                if key == "discount_type" and data[key] not in ["flat", "percent"]:
                    return jsonify({"error": "discount_type must be 'flat' or 'percent'"}), 400
                if key == "discount_value" and float(data[key]) <= 0:
                    return jsonify({"error": "discount_value must be > 0"}), 400
                if key == "max_uses" and int(data[key]) <= 0:
                    return jsonify({"error": "max_uses must be > 0"}), 400

                fields.append(sql)
                values.append(data[key])

        if not fields:
            return jsonify({"error": "No valid fields to update"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # fetch original coupon for recalculating uses_left
        cur.execute("SELECT max_uses, uses_left FROM coupons WHERE id = %s", (coupon_id,))
        original = cur.fetchone()
        if not original:
            return jsonify({"error": "Coupon not found"}), 404

        old_max = original["max_uses"]
        old_left = original["uses_left"]

        # apply update
        update_query = f"""
            UPDATE coupons
            SET {', '.join(fields)}, updated_at = NOW()
            WHERE id = %s
            RETURNING id, code, discount_type, discount_value, max_uses, uses_left, status, created_at
        """

        cur.execute(update_query, (*values, coupon_id))
        coupon = cur.fetchone()

        # special: max_uses changed → recalc uses_left
        if "max_uses" in data:
            new_max = int(data["max_uses"])
            new_left = max(0, new_max - (old_max - old_left))
            cur.execute("UPDATE coupons SET uses_left = %s WHERE id = %s", (new_left, coupon_id))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Coupon updated",
            "coupon": coupon
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
