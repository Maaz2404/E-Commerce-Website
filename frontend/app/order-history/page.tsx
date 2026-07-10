"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

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
        alert(`Refunded: ${formatCurrency(data.refund_amount)}`);
        fetchOrders();
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
      <h1 className="text-3xl font-bold mb-4 text-slate-900 dark:text-slate-50">Order History</h1>

      <div className="flex items-center mb-4 gap-4">
        <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
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
        <p className="text-slate-600 dark:text-slate-300">Loading orders...</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800">
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Order ID</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Total</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Status</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Created At</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-3 text-slate-800 dark:text-slate-200">{o.id}</td>
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{formatCurrency(o.total_amount)}</td>
                  <td
                    className={`p-3 capitalize font-semibold ${
                      o.status === "paid"
                        ? "text-green-600 dark:text-green-400"
                        : o.status === "refunded"
                        ? "text-red-500 dark:text-red-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {o.status}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-center">
                    {o.status === "paid" || o.status === "delivered" ? (
                      <button
                        onClick={() => handleRefund(o.id)}
                        disabled={processingRefund === o.id || o.status !== "paid"}
                        className={`px-3 py-1 rounded text-white ${
                          o.status === "paid" && processingRefund !== o.id
                            ? "bg-orange-500 hover:bg-orange-600"
                            : "bg-slate-300 dark:bg-slate-600 cursor-not-allowed"
                        }`}
                      >
                        {processingRefund === o.id ? "Processing..." : "Refund"}
                      </button>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500 dark:text-slate-400">
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
