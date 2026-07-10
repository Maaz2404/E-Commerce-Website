from flask import Blueprint, request, jsonify
from database import get_connection
from auth_middleware import token_required

reviews_bp = Blueprint("reviews", __name__)

# 1️⃣ Add a review
@reviews_bp.route("/add", methods=["POST"])
@token_required
def add_review(user):
    try:
        data = request.get_json()
        product_id = data.get("product_id")
        rating = data.get("rating")
        comment = data.get("comment")  # optional

        if not product_id or not rating:
            return jsonify({"error": "product_id and rating are required"}), 400
        if int(rating) < 1 or int(rating) > 5:
            return jsonify({"error": "rating must be between 1 and 5"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # check if user already reviewed
        cur.execute("""
            SELECT id FROM reviews
            WHERE user_id = %s AND product_id = %s
        """, (user["id"], product_id))
        if cur.fetchone():
            return jsonify({"error": "You have already reviewed this product"}), 400

        cur.execute("""
            INSERT INTO reviews (product_id, user_id, rating, comment)
            VALUES (%s, %s, %s, %s)
            RETURNING id, product_id, user_id, rating, comment, created_at
        """, (product_id, user["id"], rating, comment))

        review = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Review added", "review": review}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 2️⃣ Update a review
@reviews_bp.route("/<int:review_id>/update", methods=["PATCH"])
@token_required
def update_review(user, review_id):
    try:
        data = request.get_json()
        rating = data.get("rating")
        comment = data.get("comment")  # optional

        if rating and (int(rating) < 1 or int(rating) > 5):
            return jsonify({"error": "rating must be between 1 and 5"}), 400

        conn = get_connection()
        cur = conn.cursor()

        # ensure review belongs to user
        cur.execute("SELECT user_id FROM reviews WHERE id = %s", (review_id,))
        review = cur.fetchone()
        if not review:
            return jsonify({"error": "Review not found"}), 404
        if review["user_id"] != user["id"]:
            return jsonify({"error": "You cannot edit someone else's review"}), 403

        # build dynamic update
        update_fields = []
        values = []

        if rating:
            update_fields.append("rating = %s")
            values.append(rating)
        if comment is not None:
            update_fields.append("comment = %s")
            values.append(comment)

        if not update_fields:
            return jsonify({"error": "Nothing to update"}), 400

        values.append(review_id)
        cur.execute(f"""
            UPDATE reviews
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE id = %s
            RETURNING id, product_id, user_id, rating, comment, updated_at
        """, tuple(values))

        updated_review = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Review updated", "review": updated_review}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 3️⃣ Delete a review
@reviews_bp.route("/<int:review_id>/delete", methods=["DELETE"])
@token_required
def delete_review(user, review_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        # ensure review belongs to user
        cur.execute("SELECT user_id FROM reviews WHERE id = %s", (review_id,))
        review = cur.fetchone()
        if not review:
            return jsonify({"error": "Review not found"}), 404
        if review["user_id"] != user["id"]:
            return jsonify({"error": "You cannot delete someone else's review"}), 403

        cur.execute("DELETE FROM reviews WHERE id = %s RETURNING id", (review_id,))
        deleted = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Review deleted", "review_id": deleted["id"]}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    
@reviews_bp.route("/product/<int:product_id>", methods=["GET"])
def get_reviews(product_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT r.id, r.product_id, r.user_id, u.username, r.rating, r.comment, r.created_at, r.updated_at
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            WHERE r.product_id = %s
            ORDER BY r.created_at DESC
        """, (product_id,))

        reviews = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify({"reviews": reviews}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
