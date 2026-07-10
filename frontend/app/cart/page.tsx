"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from "@/components/NavBar";
import { useCartStore } from "@/store/cartStore";
import { formatCurrency } from "@/lib/format";

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
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-slate-50 dark:from-slate-950 dark:to-slate-900">
        <p className="text-slate-600 dark:text-slate-300 text-lg">Loading your cart...</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-blue-200 dark:border-slate-700 mb-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-slate-900 dark:text-slate-50">
          Your Cart
        </h1>

        {cart.items.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 text-lg">
            Your cart is empty 🛒
          </p>
        ) : (
          <div className="space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.item_id}
                className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition rounded-lg px-4 py-2"
              >
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {item.product_name}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300">
                    Price: <span className="font-medium text-blue-600 dark:text-blue-400">{formatCurrency(item.price)}</span>
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Quantity:{" "}
                    <span className="font-medium">{item.quantity}</span>
                  </p>
                  <p className="text-slate-900 dark:text-slate-50 font-semibold">
                    Total: {formatCurrency(item.total)}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(item.product_id)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                    loading
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {loading ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-lg px-4 py-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Total:</h2>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(cart.total_price)}
              </p>
            </div>
          </div>
        )}

        {message && (
          <p
            className={`mt-4 text-center font-medium p-3 rounded-lg ${
              message.startsWith("✅")
                ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40"
                : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40"
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
            className="bg-gradient-to-r from-slate-900 to-blue-900 text-white px-8 py-3 rounded-lg text-xl font-semibold hover:shadow-lg transition-all"
          >
            Pay
          </button>
        </div>
      )}
    </>
  );
}
