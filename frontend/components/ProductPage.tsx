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

  if (!product) return <p className="text-center mt-10">loading...</p>;

  const isOutOfStock = product.stock <= 0;
  const totalPrice = (product.price * quantity).toFixed(2);

  return (
    <div className="flex flex-col items-center m-5">

      {/* PRODUCT NAME */}
      <h1 className="text-4xl font-bold mb-3">{product.name}</h1>

      {/* IMAGE */}
      <div className="relative w-full max-w-md h-64 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill className="object-contain" />
        ) : "No image"}
      </div>

      {/* PRICE */}
      <p className="text-lg mt-4">Price: ${product.price.toFixed(2)}</p>

      {/* STOCK */}
      <p className="text-lg">
        Stock:
        <span className={isOutOfStock ? "text-red-500" : "text-green-600"}>
          {isOutOfStock ? " Out of stock" : ` ${product.stock}`}
        </span>
      </p>

      {/* QUANTITY */}
      <div className="mt-3 flex gap-4 items-center">
        <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-1 bg-gray-400 text-white rounded">
          -
        </button>
        <span className="text-xl">{quantity}</span>
        <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-1 bg-gray-400 text-white rounded">
          +
        </button>
      </div>

      {/* TOTAL */}
      <p className="text-xl font-bold mt-3">Total: ${totalPrice}</p>

      {/* ADD TO CART */}
      <button
        onClick={handleAddToCart}
        disabled={isOutOfStock || loading || added}
        className="mt-5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
      >
        {loading ? "Adding..." : added ? "✔ Added" : "Add to Cart"}
      </button>

      {message && <p className="mt-2 text-center text-red-500">{message}</p>}

      {/* REVIEW FORM */}
      <div className="w-full max-w-xl mt-10 p-4 border rounded-lg bg-gray-100">
        <h2 className="text-xl font-semibold mb-2">
          {userReview ? "Update Your Review" : "Add Review"}
        </h2>

        {/* RATING */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              onClick={() => setRatingInput(star)}
              className={`text-2xl ${ratingInput >= star ? "text-yellow-500" : "text-gray-400"}`}
            >
              ★
            </button>
          ))}
        </div>

        {/* COMMENT */}
        <textarea
          placeholder="Write a comment (optional)"
          className="w-full p-2 border rounded bg-white"
          value={commentInput}
          onChange={(e) => setCommentInput(e.target.value)}
        />

        {!userReview ? (
          <button
            onClick={handleAddReview}
            className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
          >
            Submit Review
          </button>
        ) : (
          <>
            <button
              onClick={handleUpdateReview}
              className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Update Review
            </button>
            <button
              onClick={handleDeleteReview}
              className="mt-3 ml-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Delete Review
            </button>
          </>
        )}
      </div>

      {/* SHOW REVIEWS */}
      <div className="w-full max-w-xl mt-8">
        <h2 className="text-2xl font-bold mb-4">Reviews</h2>
        <h2 className="text-2xl font-bold mb-4">Average Rating: {avgRating}</h2>
        <h2 className="text-2xl font-bold mb-4">Total Reviews: {totalReviews}</h2>

        {reviews.length === 0 && <p>No reviews yet.</p>}

        {reviews
          .filter((rev) =>  rev.comment !== null)
          .map((rev) => (
            <div key={rev.id} className="p-4 mb-3 border rounded bg-white shadow-sm">
              <p className="text-yellow-500 text-xl">{"★".repeat(rev.rating)}</p>
              <p className="mt-1 text-gray-700">{rev.comment}</p>
              <p className="text-sm text-gray-400 mt-1">by {rev.username || "User"}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
