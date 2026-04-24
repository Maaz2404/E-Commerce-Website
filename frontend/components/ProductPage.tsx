"use client";

import React, { useEffect, useState } from "react";
import { ProductInput } from "@/components/ProductCard";
import Image from "next/image";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

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

  if (!product) return <p className="py-10 text-center">Loading...</p>;

  const isOutOfStock = product.stock <= 0;
  const totalPrice = (product.price * quantity).toFixed(2);

  const handleAddToCart = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("Error: You must be logged in to add items to your cart.");
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
        setMessage(result.error || "Error: Failed to add to cart.");
        return;
      }

      if (result.message === "Product already in cart") {
        setMessage("Info: This product is already in your cart.");
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
        return;
      }

      if (result.message === "Product added to cart") {
        setMessage("Success: Added to cart successfully.");
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
        return;
      }

      setMessage("Info: Unexpected response. Please try again.");
    } catch (err) {
      console.error("Error adding to cart:", err);
      setMessage("Error: Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-28 mb-10 max-w-4xl px-5">
      <div className="flex flex-col items-center rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,33,0.96),rgba(4,9,18,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
        <h1 className="mb-4 text-center text-4xl font-bold text-white">
          {product.name}
        </h1>

        <div className="relative mb-4 flex h-64 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(30,41,59,0.9),rgba(7,12,20,0.95))]">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-contain"
              sizes="100%"
            />
          ) : (
            <div className="text-muted-foreground">No Image Available</div>
          )}
        </div>

        <p className="mb-3 max-w-2xl text-center text-lg text-slate-300">
          {product.description || "No description available."}
        </p>

        <p className="mb-2 text-xl font-semibold text-slate-100">
          Unit Price: ${product.price.toFixed(2)}
        </p>
        <p className="mb-2 text-lg text-slate-100">
          Stock:{" "}
          <span
            className={`font-semibold ${
              isOutOfStock ? "text-rose-300" : "text-cyan-200"
            }`}
          >
            {isOutOfStock ? "Out of Stock" : product.stock}
          </span>
        </p>

        <div className="mt-3 flex items-center gap-3">
          <button
            className="rounded-full border border-white/10 bg-secondary px-4 py-2 text-lg text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-50"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || loading}
          >
            -
          </button>
          <span className="text-xl font-semibold text-white">{quantity}</span>
          <button
            className="rounded-full border border-white/10 bg-secondary px-4 py-2 text-lg text-secondary-foreground transition-colors hover:bg-accent disabled:opacity-50"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={isOutOfStock || loading}
          >
            +
          </button>
        </div>

        <p className="mt-4 text-2xl font-bold text-blue-300">
          Total: ${totalPrice}
        </p>

        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock || loading || added}
          className={`mt-5 rounded-full px-6 py-3 font-medium transition-all text-primary-foreground ${
            isOutOfStock
              ? "cursor-not-allowed bg-destructive/80 text-destructive-foreground"
              : added
                ? "bg-primary/90"
                : "bg-primary shadow-[0_12px_30px_rgba(37,99,235,0.35)] hover:bg-accent"
          }`}
        >
          {loading
            ? "Adding..."
            : added
              ? "Added"
              : isOutOfStock
                ? "Out of Stock"
                : "Add to Cart"}
        </button>

        {message && (
          <p
            className={`mt-3 text-center ${
              message.startsWith("Error") ? "text-rose-300" : "text-cyan-200"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
