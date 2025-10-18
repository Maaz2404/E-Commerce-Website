from flask import Blueprint, request, jsonify
from database import get_connection
import psycopg2
from auth_middleware import token_required, admin_required

products_bp = Blueprint("products", __name__)

@products_bp.route("/", methods=["GET"])
def get_all_products():
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

        category = request.args.get("category")
        search = request.args.get("search")

        query = "SELECT * FROM products"
        params = []

        if category:
            query += " WHERE category = %s"
            params.append(category)
        if search:
            if "WHERE" in query:
                query += " AND name ILIKE %s"
            else:
                query += " WHERE name ILIKE %s"
            params.append(f"%{search}%")

        query += " ORDER BY id DESC"
        cur.execute(query, params)
        rows = cur.fetchall()

        if not rows:
            return jsonify({"message": "No products found"}), 404

        products = []
        for row in rows:
            products.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "price": float(row["price"]),
                "stock": int(row["stock"]),
                "category": row["category"],
                "image_url": row["image_url"]
            })

        cur.close()
        conn.close()
        return jsonify({
        "products": products
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🟢 Get single product by ID
@products_bp.route("/<int:product_id>", methods=["GET"])
def get_product(product_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM products WHERE id = %s", (product_id,))
        row = cur.fetchone()

        if not row:
            return jsonify({"error": "Product not found"}), 404

        col_names = [desc[0] for desc in cur.description]
        product = dict(zip(col_names, row))

        cur.close()
        conn.close()
        return jsonify(product), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🟢 Add a new product

@products_bp.route("/", methods=["POST"])
@token_required
@admin_required
def add_product(user):
    try:
        data = request.get_json()
        name = data.get("name")
        description = data.get("description", "")
        price = data.get("price")
        stock = data.get("stock", 0)
        category = data.get("category", "")
        image_url = data.get("image_url", "")

        if not name or not price:
            return jsonify({"error": "Missing required fields"}), 400

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO products (name, description, price, stock, category, image_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, name, description, price, stock, category, image_url;
        """, (name, description, price, stock, category, image_url))

        new_product = cur.fetchone()
        col_names = [desc[0] for desc in cur.description]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(dict(zip(col_names, new_product))), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🟢 Update product

from psycopg2.extras import RealDictCursor

@products_bp.route("/<int:product_id>", methods=["PUT"])
@token_required
@admin_required
def update_product(user, product_id):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing JSON body"}), 400

        # allow selective updates
        fields, values = [], []
        for key in ["name", "description", "price", "stock", "category", "image_url"]:
            if key in data:
                fields.append(f"{key} = %s")
                values.append(data[key])

        if not fields:
            return jsonify({"error": "No fields to update"}), 400

        values.append(product_id)
        query = f"""
            UPDATE products
            SET {', '.join(fields)}
            WHERE id = %s
            RETURNING id, name, description, price, stock, category, image_url
        """

        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(query, values)
        updated_product = cur.fetchone()

        if not updated_product:
            conn.rollback()
            cur.close()
            conn.close()
            return jsonify({"error": "Product not found"}), 404

        conn.commit()
        cur.close()
        conn.close()

        return jsonify(updated_product), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🟢 Delete product
@products_bp.route("/<int:product_id>", methods=["DELETE"])
@token_required
@admin_required
def delete_product(user,product_id):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM products WHERE id = %s RETURNING id", (product_id,))
        deleted = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        if not deleted:
            return jsonify({"error": "Product not found"}), 404

        return jsonify({"message": f"Product {product_id} deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 🟢 Decrease stock after an order
@products_bp.route("/<int:product_id>/decrement_stock", methods=["PATCH"])
@token_required
def decrement_stock(user,product_id):
    try:
        data = request.get_json()
        quantity = data.get("quantity", 1)

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE products 
            SET stock = stock - %s
            WHERE id = %s AND stock >= %s
            RETURNING *;
        """, (quantity, product_id, quantity))

        updated = cur.fetchone()
        if not updated:
            return jsonify({"error": "Insufficient stock or product not found"}), 400

        col_names = [desc[0] for desc in cur.description]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify(dict(zip(col_names, updated))), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
