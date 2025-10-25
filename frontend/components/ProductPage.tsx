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
    <div className="max-w-6xl mx-auto mt-20 px-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="flex justify-center">
          <div className="relative w-full max-w-md h-96 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                className="object-contain"
                sizes="100%"
              />
            ) : (
              <div className="text-gray-500 text-center">
                <span className="text-6xl">📦</span>
                <p className="mt-2">No Image Available</p>
              </div>
            )}
          </div>
        </div>

        {/* Product Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{product.name}</h1>
            {product.category && (
              <p className="text-orange-600 font-medium text-lg">{product.category}</p>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center space-x-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-lg">⭐</span>
              ))}
            </div>
            <span className="text-gray-600">(4.5) • 120 reviews</span>
          </div>

          {/* Price */}
          <div className="flex items-center space-x-3">
            <span className="text-3xl font-bold text-green-600">
              ${product.price.toFixed(2)}
            </span>
            <span className="text-xl text-gray-500 line-through">
              ${(product.price * 1.2).toFixed(2)}
            </span>
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">
              17% OFF
            </span>
          </div>

          {/* Stock Status */}
          <div className="flex items-center space-x-2">
            <span className="text-lg font-medium">Stock:</span>
            <span
              className={`font-semibold ${
                isOutOfStock ? "text-red-500" : "text-green-600"
              }`}
            >
              {isOutOfStock ? "Out of Stock" : `${product.stock} available`}
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Description</h3>
            <p className="text-gray-700 leading-relaxed">
              {product.description || "No description available for this product."}
            </p>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Quantity</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center border rounded-lg">
                <button
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-l-lg disabled:opacity-50"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || loading}
                >
                  -
                </button>
                <span className="px-4 py-2 font-semibold">{quantity}</span>
                <button
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-r-lg disabled:opacity-50"
                  onClick={() => setQuantity((q) => q + 1)}
                  disabled={isOutOfStock || loading}
                >
                  +
                </button>
              </div>
              <span className="text-gray-600">
                Total: <span className="font-bold text-lg">${totalPrice}</span>
              </span>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || loading || added}
            className={`w-full py-3 px-6 rounded-lg text-white font-semibold text-lg transition-all ${
              isOutOfStock
                ? "bg-gray-400 cursor-not-allowed"
                : added
                ? "bg-green-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {loading
              ? "Adding to Cart..."
              : added
              ? "✓ Added to Cart"
              : isOutOfStock
              ? "Out of Stock"
              : "Add to Cart"}
          </button>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm">Free Shipping</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm">7-Day Return</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm">Secure Payment</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm">Authentic Product</span>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-center font-medium ${
                message.startsWith("✅") || message.includes("Added")
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
