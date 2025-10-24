"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from "@/components/NavBar";

export interface CartItem {
  item_id: number;
  product_name: string;
  product_id:number;
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

  // ✅ Fetch Cart (only runs if token valid)
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

  // ✅ Auth check + fetch logic
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(token);
      if (decoded?.user_id) {
        fetchCart(); // ✅ just fetch — no redirect
      } else {
        router.push("/login");
      }
    } catch (err) {
      console.error("Invalid token:", err);
      router.push("/login");
    }
  }, [router]);

  // ✅ Delete item
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

      // Optimistically update UI
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
    <div className="max-w-4xl mx-auto mt-20 p-6 bg-white shadow-md rounded-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
        Your Cart
      </h1>

      {cart.items.length === 0 ? (
        <p className="text-center text-gray-500 text-lg">Your cart is empty 🛒</p>
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
                  Quantity: <span className="font-medium">{item.quantity}</span>
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
  );
}
