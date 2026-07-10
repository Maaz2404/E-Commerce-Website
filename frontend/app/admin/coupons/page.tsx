"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

type Coupon = {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number;
  uses_left: number;
  status: string;
  created_at: string;
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [edited, setEdited] = useState<Record<number, Partial<Coupon>>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCoupon, setNewCoupon] = useState({
    code: "",
    discount_type: "flat",
    discount_value: "",
    max_uses: "",
  });

  const fetchCoupons = async () => {
    try {
      const res = await fetch(`${BASE_URL}/coupons/active`);
      const data = await res.json();
      setCoupons(data.active_coupons || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const updateCoupon = async (id: number) => {
    const token = localStorage.getItem("token");
    const payload = edited[id];

    if (!payload) return;

    try {
      const res = await fetch(`${BASE_URL}/coupons/update/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        alert("Failed to update coupon");
        return;
      }

      setCoupons((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...payload } : c))
      );

      setEdited((prev) => {
        const clone = { ...prev };
        delete clone[id];
        return clone;
      });

      setEditingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const createCoupon = async () => {
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${BASE_URL}/coupons/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newCoupon),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create coupon");
        return;
      }

      setShowCreate(false);
      setNewCoupon({
        code: "",
        discount_type: "flat",
        discount_value: "",
        max_uses: "",
      });

      fetchCoupons();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p className="p-6 text-center text-gray-600">Loading coupons...</p>;

  const statuses = ["active", "inactive", "expired"];
  const types = ["flat", "percent"];

  return (
    <div className="w-full">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Coupons</h1>
            <p className="text-gray-600 mt-2">Manage and create discount coupons</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-lg shadow-md transition"
          >
            + Create Coupon
          </button>
        </div>

        {/* CREATE MODAL */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl w-full max-w-md shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Create New Coupon</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input
                    placeholder="e.g., SUMMER20"
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newCoupon.code}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, code: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newCoupon.discount_type}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, discount_type: e.target.value })
                    }
                  >
                    {types.map((t) => (
                      <option key={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Value</label>
                  <input
                    placeholder={newCoupon.discount_type === "percent" ? "e.g., 20" : "e.g., 50"}
                    type="number"
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newCoupon.discount_value}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, discount_value: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Uses</label>
                  <input
                    placeholder="e.g., 100"
                    type="number"
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={newCoupon.max_uses}
                    onChange={(e) =>
                      setNewCoupon({ ...newCoupon, max_uses: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createCoupon}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {editingId !== null && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl w-full max-w-md shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">Edit Coupon</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                  <input
                    defaultValue={coupons.find(c => c.id === editingId)?.code}
                    onChange={(e) =>
                      setEdited((prev) => ({
                        ...prev,
                        [editingId]: { ...prev[editingId], code: e.target.value },
                      }))
                    }
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    defaultValue={coupons.find(c => c.id === editingId)?.discount_type}
                    onChange={(e) =>
                      setEdited((prev) => ({
                        ...prev,
                        [editingId]: { ...prev[editingId], discount_type: e.target.value },
                      }))
                    }
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {types.map((t) => (
                      <option key={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Value</label>
                  <input
                    type="number"
                    defaultValue={coupons.find(c => c.id === editingId)?.discount_value}
                    onChange={(e) =>
                      setEdited((prev) => ({
                        ...prev,
                        [editingId]: { ...prev[editingId], discount_value: Number(e.target.value) },
                      }))
                    }
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Uses</label>
                  <input
                    type="number"
                    defaultValue={coupons.find(c => c.id === editingId)?.max_uses}
                    onChange={(e) =>
                      setEdited((prev) => ({
                        ...prev,
                        [editingId]: { ...prev[editingId], max_uses: Number(e.target.value) },
                      }))
                    }
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    defaultValue={coupons.find(c => c.id === editingId)?.status}
                    onChange={(e) =>
                      setEdited((prev) => ({
                        ...prev,
                        [editingId]: { ...prev[editingId], status: e.target.value },
                      }))
                    }
                    className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {statuses.map((s) => (
                      <option key={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setEditingId(null)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateCoupon(editingId)}
                  className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CARD GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {coupons.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 overflow-hidden"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 font-medium">Coupon Code</p>
                    <p className="text-2xl font-bold text-gray-900 tracking-wide">{c.code}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                    c.status === "active"
                      ? "bg-green-100 text-green-700"
                      : c.status === "inactive"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {c.status}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 space-y-4">
                {/* Discount */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 font-medium text-sm">Discount</span>
                  <span className="text-lg font-bold text-orange-600">
                    {c.discount_type === "percent"
                      ? `${c.discount_value}%`
                      : formatCurrency(c.discount_value)}
                  </span>
                </div>

                {/* Usage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600 font-medium text-sm">Usage</span>
                    <span className="text-sm text-gray-700">
                      {c.max_uses - c.uses_left} / {c.max_uses}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${((c.max_uses - c.uses_left) / c.max_uses) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>

                {/* Created Date */}
                <div className="pt-2">
                  <p className="text-xs text-gray-500">
                    Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <button
                  onClick={() => setEditingId(c.id)}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {coupons.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No coupons found</p>
            <p className="text-gray-500 mt-2">Create your first coupon to get started</p>
          </div>
        )}

      </div>
    </div>
  );
}
