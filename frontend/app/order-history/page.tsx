"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Order = {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaidOnly, setShowPaidOnly] = useState(false);
  const [processingRefund, setProcessingRefund] = useState<number | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/orders/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setOrders(
  data.map((o: any) => ({ ...o, total_amount: Number(o.total_amount) }))
);

    } catch (err) {
      console.error(err);
      alert("Failed to fetch orders.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefund = async (orderId: number) => {
    if (!confirm("Are you sure you want to refund this order?")) return;

    setProcessingRefund(orderId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/orders/${orderId}/refund`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Refund failed.");
      } else {
        alert(`Refunded: $${data.refund_amount}`);
        fetchOrders(); // refresh list
      }
    } catch (err) {
      console.error(err);
      alert("Refund failed.");
    }
    setProcessingRefund(null);
  };

  const filteredOrders = showPaidOnly
    ? orders.filter((o) => o.status === "paid")
    : orders;

  return (
    <div className="p-6 w-full max-w-full mt-2">
      <h1 className="text-3xl font-bold mb-4">Order History</h1>

      <div className="flex items-center mb-4 gap-4">
        <label className="flex items-center gap-2 text-gray-700">
          <input
            type="checkbox"
            checked={showPaidOnly}
            onChange={(e) => setShowPaidOnly(e.target.checked)}
            className="accent-orange-500"
          />
          Show only refundable orders
        </label>
        <button
          onClick={fetchOrders}
          className="bg-orange-500 text-white px-4 py-1 rounded hover:bg-orange-600"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading orders...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border">Order ID</th>
                <th className="p-3 border">Total ($)</th>
                <th className="p-3 border">Status</th>
                <th className="p-3 border">Created At</th>
                
                <th className="p-3 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border">
                  <td className="p-3 border">{o.id}</td>
                  <td className="p-3 border">{o.total_amount.toFixed(2)}</td>
                  <td
                    className={`p-3 border capitalize font-semibold ${
                      o.status === "paid"
                        ? "text-green-600"
                        : o.status === "refunded"
                        ? "text-red-500"
                        : "text-gray-700"
                    }`}
                  >
                    {o.status}
                  </td>
                  <td className="p-3 border">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                
                  <td className="p-3 border text-center">
                    {o.status === "paid" || o.status === "delivered" ? (
                      <button
                        onClick={() => handleRefund(o.id)}
                        disabled={o.status !== "paid"}
                        className={`px-3 py-1 rounded text-white ${
                            o.status === "paid"
                            ? "bg-orange-500 hover:bg-orange-600"
                            : "bg-gray-300 cursor-not-allowed"
                        }`}
                        >
                        Refund
                        </button>

                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
