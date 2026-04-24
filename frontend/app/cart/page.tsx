"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from "@/components/NavBar";

export interface CartItem {
  item_id: number;
  product_name: string;
  product_id: number;
  price: number;
  quantity: number;
  total: number;
}

export interface Cart {
  cart_id: number;
  items: CartItem[];
  total_price: number;
}

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5000";

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
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
      setMessage("Error: Failed to load cart.");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      if (decoded?.user_id) {
        fetchCart();
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("Invalid token:", err);
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

      setCart((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((item) => item.product_id !== itemId),
              total_price: prev.items
                .filter((item) => item.product_id !== itemId)
                .reduce((sum, item) => sum + item.total, 0),
            }
          : prev
      );

      setMessage("Success: Item removed successfully.");
    } catch (err) {
      console.error("Error removing item:", err);
      setMessage("Error: Failed to remove item. Please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(""), 2500);
    }
  };

  if (!cart) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-lg text-slate-300">Loading your cart...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-28 max-w-4xl px-5 pb-10">
      <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,33,0.96),rgba(4,9,18,0.98))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">
          Your Cart
        </h1>

        {cart.items.length === 0 ? (
          <p className="text-center text-lg text-slate-300">
            Your cart is empty.
          </p>
        ) : (
          <div className="space-y-4">
            {cart.items.map((item) => (
              <div
                key={item.item_id}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-5 py-4"
              >
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {item.product_name}
                  </h2>
                  <p className="text-slate-300">
                    Price: <span className="font-medium">${item.price}</span>
                  </p>
                  <p className="text-slate-300">
                    Quantity: <span className="font-medium">{item.quantity}</span>
                  </p>
                  <p className="font-semibold text-slate-100">
                    Total: ${item.total.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={() => handleDelete(item.product_id)}
                  disabled={loading}
                  className={`rounded-md px-4 py-2 font-medium text-white transition-colors ${
                    loading
                      ? "cursor-not-allowed bg-slate-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {loading ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-white/10 pt-4">
              <h2 className="text-xl font-bold text-white">Total:</h2>
              <p className="text-2xl font-bold text-blue-300">
                ${cart.total_price.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {message && (
          <p
            className={`mt-4 text-center font-medium ${
              message.startsWith("Success") ? "text-cyan-200" : "text-rose-300"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
