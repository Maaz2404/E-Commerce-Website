"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { ProductInput } from "@/components/ProductCard";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

interface ProductPageProps {
  id: number | string;
}

export default function ProductView({ id }: ProductPageProps) {
  // -----------------------------------------------------
  // HOOKS (NEVER MOVE THESE)
  // -----------------------------------------------------
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<ProductInput | null>(null);

  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  const [userReview, setUserReview] = useState<any | null>(null); // the logged-in user's full review object
  const [userReviewId, setUserReviewId] = useState<number | null>(null); // review.id for update/delete

  const [ratingInput, setRatingInput] = useState(0);
  const [commentInput, setCommentInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);

  // -----------------------------------------------------
  // FETCH PRODUCT
  // -----------------------------------------------------
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${baseURL}/products/${id}`);
        const data = await res.json();
        setProduct(data?.product || null);
      } catch (err) {
        console.error("Product fetch err:", err);
      }
    };
    fetchProduct();
  }, [id]);

  // -----------------------------------------------------
  // FETCH REVIEWS WHEN PRODUCT IS LOADED
  // -----------------------------------------------------
  useEffect(() => {
    if (!product) return;
    fetchReviews();
  }, [product]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${baseURL}/reviews/product/${id}`);
      const data = await res.json();

      const token = localStorage.getItem("token");
      let currentUserId = null;

      if (token) {
        const decoded: any = JSON.parse(atob(token.split(".")[1]));
        currentUserId = decoded.user_id;
      }

      const list = data.reviews || [];

      setReviews(list);

      const myReview = list.find((r: any) => r.user_id === currentUserId) || null;

      setUserReview(myReview);
      setUserReviewId(myReview?.id || null);

      // prefill form for update
      if (myReview) {
        setRatingInput(myReview.rating);
        setCommentInput(myReview.comment || "");
      }

      // ⭐ FIXED AVG RATING (using list, NOT reviews state)
      if (list.length > 0) {
        const total = list.reduce((sum: number, r: any) => sum + r.rating, 0);
        setAvgRating(total / list.length);
        setTotalReviews(list.length);
      } else {
        setAvgRating(0);
        setTotalReviews(0);
      }

    } catch (err) {
      console.log("Review fetch error:", err);
    }
  };

  // -----------------------------------------------------
  // ADD REVIEW (POST)
  // -----------------------------------------------------
  const handleAddReview = async () => {
    const token = localStorage.getItem("token");
    if (!token) return setMessage("Login to add review");

    try {
      const res = await fetch(`${baseURL}/reviews/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_id: id,
          rating: ratingInput,
          comment: commentInput.trim() === "" ? null : commentInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Failed to add review");
        return;
      }

      setMessage("Review added 🎉");
      fetchReviews();
    } catch (err) {
      setMessage("Something went wrong");
    }
  };

  // -----------------------------------------------------
  // UPDATE REVIEW (PATCH)
  // -----------------------------------------------------
  const handleUpdateReview = async () => {
    if (!userReviewId) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${baseURL}/reviews/${userReviewId}/update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: ratingInput,
          comment: commentInput.trim() === "" ? null : commentInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Update failed");
        return;
      }

      setMessage("Review updated ✨");
      fetchReviews();
    } catch (err) {
      setMessage("Error updating review");
    }
  };

  // -----------------------------------------------------
  // DELETE REVIEW
  // -----------------------------------------------------
  const handleDeleteReview = async () => {
    const token = localStorage.getItem("token");
    if (!token || !userReviewId) return;

    try {
      await fetch(`${baseURL}/reviews/${userReviewId}/delete`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage("Review deleted");
      setRatingInput(0);
      setCommentInput("");
      setUserReview(null);
      setUserReviewId(null);

      fetchReviews();
    } catch (err) {
      setMessage("Delete failed");
    }
  };

  // -----------------------------------------------------
  // CART ADD
  // -----------------------------------------------------
  const handleAddToCart = async () => {
    const token = localStorage.getItem("token");
    if (!token) return setMessage("⚠️ login first");

    try {
      setLoading(true);
      const res = await fetch(`${baseURL}/carts/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: id, quantity }),
      });

      const data = await res.json();
      if (!res.ok) return setMessage(data.error || "Failed");

      setMessage("Added Successfully");
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  if (!product) return <div className="text-center mt-20 text-gray-500 text-lg">Loading...</div>;

  const isOutOfStock = product.stock <= 0;
  const totalPrice = (product.price * quantity).toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-50 mt-20">
      {/* PRODUCT SECTION */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">

          {/* LEFT — IMAGE */}
          <div className="flex justify-center items-center bg-white rounded-lg p-8 sticky top-24 h-fit shadow-md border border-blue-200">
            <div className="relative w-full max-w-md h-96">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="text-slate-400 flex justify-center items-center h-full text-lg">
                  No image available
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — PRODUCT INFO & CTA */}
          <div className="flex flex-col justify-start space-y-6">

            {/* Product Name */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-3">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-3 mt-4">
                {totalReviews > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500 text-2xl">★</span>
                      <span className="text-xl font-semibold text-slate-900">
                        {avgRating.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-slate-500">({totalReviews} reviews)</span>
                  </>
                ) : (
                  <span className="text-slate-500">No reviews yet</span>
                )}
              </div>
            </div>

            {/* Price Section */}
            <div className="border-t border-b border-blue-200 py-6 space-y-3">
              <div>
                <p className="text-slate-600 text-sm font-medium mb-1">Price</p>
                <p className="text-4xl font-bold text-blue-700">
                  ${product.price.toFixed(2)}
                </p>
              </div>

              {/* Stock Status */}
              <div className="pt-3">
                <p className={`text-lg font-semibold ${
                  isOutOfStock ? "text-red-600" : "text-green-600"
                }`}>
                  {isOutOfStock ? "❌ Out of Stock" : `✓ ${product.stock} in stock`}
                </p>
              </div>
            </div>

            {/* Quantity & Cart */}
            <div className="space-y-4">
              {/* Quantity Selector */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Quantity</p>
                <div className="flex items-center border border-blue-300 rounded-lg w-fit focus-within:ring-2 focus-within:ring-blue-500">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={isOutOfStock}
                    className="px-4 py-2 text-slate-600 hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    −
                  </button>
                  <span className="px-6 py-2 font-semibold text-slate-900 border-l border-r border-blue-300">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    disabled={isOutOfStock}
                    className="px-4 py-2 text-slate-600 hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || loading || added}
                className={`w-full py-3 px-6 rounded-lg font-bold text-lg transition ${
                  isOutOfStock
                    ? "bg-slate-400 text-slate-600 cursor-not-allowed"
                    : added
                    ? "bg-green-500 text-white"
                    : "bg-gradient-to-r from-slate-900 to-blue-900 hover:shadow-lg text-white"
                }`}
              >
                {loading ? "Adding..." : added ? "✔ Added to Cart" : "Add to Cart"}
              </button>

              {message && (
                <p className={`text-sm font-medium ${message.includes("login") ? "text-red-600" : "text-green-600"}`}>
                  {message}
                </p>
              )}
            </div>

            
          </div>
        </div>
      </div>

      {/* REVIEWS SECTION */}
      <div className="bg-white border-t border-blue-200 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Reviews Heading */}
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Customer Reviews</h2>

          {/* Write/Edit Review Form */}
          <div className="bg-blue-50 rounded-lg shadow-md p-8 mb-8 border border-blue-200">
            <h3 className="text-xl font-bold text-slate-900 mb-6">
              {userReview ? "Update Your Review" : "Write a Review"}
            </h3>

            {/* Rating Stars */}
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-700 mb-3">Your Rating</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRatingInput(star)}
                    className={`text-4xl transition transform hover:scale-110 ${
                      ratingInput >= star ? "text-blue-500" : "text-slate-300"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Comment Textarea */}
            <div className="mb-6">
              <label className="text-sm font-medium text-slate-700 block mb-3">
                Your Comment
              </label>
              <textarea
                className="w-full p-4 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="Share your experience with this product..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            {!userReview ? (
              <button
                onClick={handleAddReview}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                Submit Review
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleUpdateReview}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                >
                  Update Review
                </button>
                <button
                  onClick={handleDeleteReview}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
                >
                  Delete Review
                </button>
              </div>
            )}
          </div>

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <p className="text-lg">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews
                .filter(r => r.comment !== null)
                .map(r => (
                  <div key={r.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-yellow-400 text-lg font-semibold">
                          {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">by <span className="font-semibold text-gray-900">{r.username || "Anonymous"}</span></p>
                      </div>
                    </div>
                    <p className="text-gray-800 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}