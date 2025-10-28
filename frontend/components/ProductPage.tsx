"use client";
import React, { useState, useEffect } from "react";
import { ProductInput } from "@/components/ProductCard";
import Image from "next/image";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

interface ProductPageProps {
  id: number | string;
}

export default function ProductView({ id }: ProductPageProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [product, setProduct] = useState<ProductInput | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [added, setAdded] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${baseURL}/products/${id}`);
        const productData = await res.json();
        setProduct(productData?.product ?? null);
      } catch (err) {
        console.error("Error fetching product:", err);
      }
    };

    fetchProduct();
  }, [id]);

  if (!product) return <p className="text-center py-10">Loading...</p>;

  const isOutOfStock = product.stock <= 0;
  const totalPrice = (product.price * quantity).toFixed(2);

  const handleAddToCart = async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    setMessage("⚠️ You must be logged in to add items to your cart.");
    return;
  }

  try {
    setLoading(true);
    setMessage("");

    const res = await fetch(`${baseURL}/carts/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: id,
        quantity,
      }),
    });

    const result = await res.json();

    if (!res.ok && result.error) {
      setMessage(result.error || "❌ Failed to add to cart.");
      return;
    }

    if (result.message === "Product already in cart") {
      setMessage("🛒 This product is already in your cart!");
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      return;
    }

    if (result.message === "Product added to cart") {
      setMessage("✅ Added to cart successfully!");
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      return;
    }

    setMessage("ℹ️ Unexpected response. Please try again.");

  } catch (err) {
    console.error("Error adding to cart:", err);
    setMessage("⚠️ Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="flex flex-col items-center m-5">
      <h1 className="font-bold text-4xl mb-4">{product.name}</h1>

      <div className="relative w-full max-w-md h-64 mb-4 rounded-lg overflow-hidden flex items-center justify-center bg-gray-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain"
            sizes="100%"
          />
        ) : (
          <div className="text-gray-500">No Image Available</div>
        )}
      </div>

      <p className="text-gray-700 text-lg text-center max-w-2xl mb-3">
        {product.description || "No description available."}
      </p>

      <p className="text-xl font-semibold mb-2">
        Unit Price: ${product.price.toFixed(2)}
      </p>
      <p className="text-lg mb-2">
        Stock:{" "}
        <span
          className={`font-semibold ${
            isOutOfStock ? "text-red-500" : "text-green-600"
          }`}
        >
          {isOutOfStock ? "Out of Stock" : product.stock}
        </span>
      </p>

      <div className="flex items-center gap-3 mt-3">
        <button
          className="px-3 py-1 bg-gray-400 rounded text-white text-lg disabled:opacity-50"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1 || loading}
        >
          -
        </button>
        <span className="text-xl font-semibold">{quantity}</span>
        <button
          className="px-3 py-1 bg-gray-400 rounded text-white text-lg disabled:opacity-50"
          onClick={() => setQuantity((q) => q + 1)}
          disabled={isOutOfStock || loading}
        >
          +
        </button>
      </div>

      <p className="text-2xl font-bold mt-4">Total: ${totalPrice}</p>

      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock || loading || added}
        className={`mt-5 px-6 py-2 rounded-lg text-white font-medium transition-all ${
          isOutOfStock
            ? "bg-gray-400 cursor-not-allowed"
            : added
            ? "bg-green-600"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading
          ? "Adding..."
          : added
          ? "✔ Added"
          : isOutOfStock
          ? "Out of Stock"
          : "Add to Cart"}
      </button>

      {message && (
        <p
          className={`mt-3 text-center ${
            message.startsWith("✅") ? "text-green-600" : "text-red-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
