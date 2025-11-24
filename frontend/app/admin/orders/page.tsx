"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

type Order = {
  id: number;
  username: string;
  total_amount: string;
  status: string;
  created_at: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [editedStatus, setEditedStatus] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${BASE_URL}/orders/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch orders");
      const data = await res.json();

      setOrders(data);
    } catch (err) {
      console.error(err);
      setError("Could not load orders");
    } finally {
      setLoading(false);
    }
  };

  const saveStatus = async (orderId: number) => {
    const newStatus = editedStatus[orderId];
    if (!newStatus) return;

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${BASE_URL}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update order");
        return;
      }

      // update UI
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        )
      );

      // remove save state
      setEditedStatus((prev) => {
        const clone = { ...prev };
        delete clone[orderId];
        return clone;
      });
    } catch (err) {
      console.error(err);
      alert("Could not update status");
    }
  };

  if (loading) return <p className="p-6">Loading orders...</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;

  const statusOptions = [
    "pending",
    "paid",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];

  return (
    <div className="p-6 w-full">
      <h1 className="text-xl font-bold mb-4">All Orders</h1>

      <div className="overflow-x-auto w-full">
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border">Order ID</th>
              <th className="p-3 border">User</th>
              <th className="p-3 border">Amount</th>
              <th className="p-3 border">Status</th>
              <th className="p-3 border">Date</th>
              <th className="p-3 border">Save</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => {
              const changed = editedStatus[order.id] && editedStatus[order.id] !== order.status;

              return (
                <tr key={order.id} className="border">
                  <td className="p-3 border">{order.id}</td>
                  <td className="p-3 border">{order.username}</td>
                  <td className="p-3 border">${order.total_amount}</td>

                  {/* STATUS DROPDOWN */}
                  <td className="p-3 border">
                    <select
                      defaultValue={order.status}
                      onChange={(e) =>
                        setEditedStatus((prev) => ({
                          ...prev,
                          [order.id]: e.target.value,
                        }))
                      }
                      className="border px-2 py-1 rounded capitalize"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="p-3 border">
                    {new Date(order.created_at).toLocaleString()}
                  </td>

                  {/* DYNAMIC SAVE BUTTON */}
                  <td className="p-3 border text-center">
                    {changed ? (
                      <button
                        onClick={() => saveStatus(order.id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                      >
                        Save
                      </button>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

        </table>
      </div>
    </div>
  );
}
