# place_order.py
from datetime import datetime

def create_order_for_user(user_id, cur, conn, coupon_code=None, validate_coupon_fn=None):
    # 1) Get user cart
    cur.execute("SELECT id FROM carts WHERE user_id = %s", (user_id,))
    cart = cur.fetchone()
    if not cart:
        raise Exception("Cart not found")

    cart_id = cart["id"]

    # 2) Fetch cart items
    cur.execute("""
        SELECT ci.product_id, ci.quantity, p.price
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = %s
    """, (cart_id,))
    cart_items = cur.fetchall()
    if not cart_items:
        raise Exception("Cart is empty")

    # 3) Calculate raw total
    raw_total = sum(float(i["price"]) * i["quantity"] for i in cart_items)

    coupon_id = None
    discount_amount = 0.0

    # 4) Handle coupon only if provided
    if coupon_code and validate_coupon_fn:
        result = validate_coupon_fn(conn, cur, user_id, coupon_code)

        if not result["valid"]:
            raise Exception(result["message"])

        coupon_id = result["coupon_id"]
        discount_type = result["discount_type"]
        discount_value = float(result["discount_value"])

        # percent or flat?
        if discount_type.lower() in ("percent", "percentage", "pct"):
            discount_amount = round((discount_value / 100) * raw_total, 2)
        else:
            discount_amount = round(discount_value, 2)

        # don’t let discount exceed total
        if discount_amount > raw_total:
            discount_amount = raw_total

        # ⚠️ DO NOT decrement uses_left here
        # make_payment handles it AFTER successful payment

    # 5) Final price
    total_amount = round(raw_total - discount_amount, 2)
    if total_amount < 0:
        total_amount = 0.0

    # 6) Insert order (only store valid fields!)
    cur.execute("""
        INSERT INTO orders (user_id, total_amount, created_at, updated_at)
        VALUES (%s, %s, NOW(), NOW())
        RETURNING id, status, created_at
    """, (user_id, total_amount))

    order = cur.fetchone()
    order_id = order["id"]

    # 7) Insert order items
    for item in cart_items:
        cur.execute("""
            INSERT INTO order_items (order_id, product_id, quantity, unit_price)
            VALUES (%s, %s, %s, %s)
        """, (
            order_id,
            item["product_id"],
            item["quantity"],
            float(item["price"])
        ))

    # 8) clear cart
    cur.execute("DELETE FROM cart_items WHERE cart_id = %s", (cart_id,))

    return {
        "order_id": order_id,
        "items": cart_items,
        "raw_total": raw_total,
        "discount_amount": discount_amount,
        "coupon_id": coupon_id,
        "total_amount": total_amount
    }


# place_order.py (validate_coupon)
def validate_coupon(conn, cur, user_id, coupon_code):
    """
    Validates a coupon for a given user.
    Returns: dict with {valid: bool, discount_type: str, discount_value: float, coupon_id: int, message: str}
    """
    try:
        cur.execute("""
            SELECT id, discount_type, discount_value, uses_left, status, start_date, end_date
            FROM coupons
            WHERE code = %s
        """, (coupon_code,))
        coupon = cur.fetchone()

        if not coupon:
            return {"valid": False, "message": "Coupon not found"}

        if coupon["status"] != "active":
            return {"valid": False, "message": "Coupon is not active"}

        # optional: check start/end dates if set
        # if coupon["start_date"] and coupon["start_date"] > date.today(): ...
        # if coupon["end_date"] and coupon["end_date"] < date.today(): ...

        if coupon["uses_left"] <= 0:
            return {"valid": False, "message": "Coupon has no uses left"}

        # Check if user already redeemed it
        cur.execute("""
            SELECT 1 FROM coupon_redemptions
            WHERE user_id = %s AND coupon_id = %s
        """, (user_id, coupon["id"]))
        redeemed = cur.fetchone()
        if redeemed:
            return {"valid": False, "message": "Coupon already used by this user"}

        return {
            "valid": True,
            "discount_type": coupon["discount_type"],
            "discount_value": float(coupon["discount_value"]),
            "coupon_id": coupon["id"]
        }

    except Exception as e:
        return {"valid": False, "message": str(e)}
