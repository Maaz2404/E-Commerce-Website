from flask import Blueprint, jsonify
from database import get_connection
from auth_middleware import token_required, admin_required

stats_bp = Blueprint("stats", __name__)

@stats_bp.route("", methods=["GET"])
@token_required
@admin_required
def get_admin_stats(user):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # ---------- USERS ----------
        cur.execute("SELECT COUNT(*) AS total_users FROM users")
        total_users = cur.fetchone()["total_users"]

        cur.execute("SELECT COUNT(*) AS normal_users FROM users WHERE role = 'user'")
        normal_users = cur.fetchone()["normal_users"]

        cur.execute("SELECT COUNT(*) AS admin_users FROM users WHERE role = 'admin'")
        admin_users = cur.fetchone()["admin_users"]

        cur.execute("""
            SELECT id, username, email, created_at 
            FROM users ORDER BY created_at DESC LIMIT 5
        """)
        latest_users = cur.fetchall()

        # ---------- ORDERS ----------
        cur.execute("SELECT COUNT(*) AS total_orders FROM orders")
        total_orders = cur.fetchone()["total_orders"]

        cur.execute("SELECT COUNT(*) AS pending_orders FROM orders WHERE status = 'pending'")
        pending_orders = cur.fetchone()["pending_orders"]

        cur.execute("SELECT COUNT(*) AS completed_orders FROM orders WHERE status = 'completed'")
        completed_orders = cur.fetchone()["completed_orders"]

        cur.execute("SELECT COALESCE(SUM(total_amount),0) AS total_revenue FROM orders")
        total_revenue = cur.fetchone()["total_revenue"]

        cur.execute("""
            SELECT COALESCE(SUM(total_amount),0) AS revenue_last_30_days
            FROM orders
            WHERE created_at >= NOW() - INTERVAL '30 days'
        """)
        revenue_last_30_days = cur.fetchone()["revenue_last_30_days"]

        # ---------- PRODUCTS ----------
        cur.execute("SELECT COUNT(*) AS total_products FROM products")
        total_products = cur.fetchone()["total_products"]

        cur.execute("SELECT COUNT(*) AS out_of_stock FROM products WHERE stock = 0")
        out_of_stock = cur.fetchone()["out_of_stock"]

        cur.execute("SELECT COUNT(*) AS low_stock FROM products WHERE stock < 5")
        low_stock = cur.fetchone()["low_stock"]

        # ---------- COUPONS ----------
        cur.execute("SELECT COUNT(*) AS total_coupons FROM coupons")
        total_coupons = cur.fetchone()["total_coupons"]

        cur.execute("SELECT COUNT(*) AS active_coupons FROM coupons WHERE status = 'active'")
        active_coupons = cur.fetchone()["active_coupons"]

        cur.execute("SELECT COUNT(*) AS expired_coupons FROM coupons WHERE status = 'expired'")
        expired_coupons = cur.fetchone()["expired_coupons"]

        cur.execute("""
            SELECT code, (max_uses - uses_left) AS used_count
            FROM coupons
            ORDER BY used_count DESC
            LIMIT 1
        """)
        most_used_coupon = cur.fetchone()

        # ---------- SUPPORT ----------
        cur.execute("SELECT COUNT(*) AS unread_messages FROM support_messages WHERE is_read = FALSE")
        unread_messages = cur.fetchone()["unread_messages"]

        cur.execute("SELECT COUNT(*) AS total_support_messages FROM support_messages")
        total_support_messages = cur.fetchone()["total_support_messages"]

        cur.close()
        conn.close()

        # return structured response
        return jsonify({
            "users": {
                "total": total_users,
                "normal_users": normal_users,
                "admins": admin_users,
                "latest_users": latest_users
            },
            "orders": {
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "completed_orders": completed_orders,
                "total_revenue": float(total_revenue),
                "revenue_last_30_days": float(revenue_last_30_days)
            },
            "products": {
                "total_products": total_products,
                "out_of_stock": out_of_stock,
                "low_stock": low_stock
            },
            "coupons": {
                "total_coupons": total_coupons,
                "active": active_coupons,
                "expired": expired_coupons,
                "most_used_coupon": most_used_coupon
            },
            "support": {
                "unread_messages": unread_messages,
                "total_support_messages": total_support_messages
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
