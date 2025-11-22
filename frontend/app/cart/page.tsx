"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from "@/components/NavBar";
import { useCartStore } from "@/store/cartStore";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function CartPage() {
  const router = useRouter();

  const { cart, setCart, removeItem } = useCartStore();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchCart = async () => {
    try {
      const res = await fetch(`${baseURL}/carts/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch cart");

      const data = await res.json();
      setCart(data);
    } catch (err) {
      console.error("Error fetching cart:", err);
      setMessage("❌ Failed to load cart.");
    }
  };

  const handlePay = () => {
    router.push("/order");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return router.push("/login");

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      if (!decoded?.user_id) return router.push("/login");

      fetchCart();
    } catch {
      router.push("/login");
    }
  }, [router]);

  const handleDelete = async (itemId: number) => {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`${baseURL}/carts/remove/${itemId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error("Failed to delete item");

      // update global store
      removeItem(itemId);

      setMessage("✅ Item removed successfully!");
    } catch (err) {
      console.error("Error removing item:", err);
      setMessage("❌ Failed to remove item. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  if (!cart) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-600 text-lg">Loading your cart...</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto mt-20 p-6 bg-white shadow-md rounded-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Your Cart
        </h1>

        {cart.items.length === 0 ? (
          <p className="text-center text-gray-500 text-lg">
            Your cart is empty 🛒
          </p>
        ) : (
          <div className="space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.item_id}
                className="flex justify-between items-center border-b border-gray-200 pb-4"
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {item.product_name}
                  </h2>
                  <p className="text-gray-600">
                    Price: <span className="font-medium">${item.price}</span>
                  </p>
                  <p className="text-gray-600">
                    Quantity:{" "}
                    <span className="font-medium">{item.quantity}</span>
                  </p>
                  <p className="text-gray-800 font-semibold">
                    Total: ${item.total.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(item.product_id)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-md text-white font-medium transition-colors ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {loading ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}

            <div className="border-t border-gray-300 pt-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Total:</h2>
              <p className="text-2xl font-bold text-green-600">
                ${cart.total_price.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {message && (
          <p
            className={`mt-4 text-center font-medium ${
              message.startsWith("✅") ? "text-green-600" : "text-red-500"
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {cart.items.length > 0 && (
        <div className="w-full flex justify-center mt-6 mb-12">
          <button
            onClick={handlePay}
            className="bg-orange-500 text-white px-8 py-3 rounded-lg text-xl font-semibold hover:bg-orange-600 transition-colors"
          >
            Pay
          </button>
        </div>
      )}
    </>
  );
}
