"use client";

import { useEffect, useState } from "react";

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

  if (loading) return <p className="p-6">Loading coupons...</p>;

  const statuses = ["active", "inactive", "expired"];
  const types = ["flat", "percent"];

  return (
    <div className="p-6 w-full">
      {/* tighter container, prevents excessive stretching but allows full row on wider screens */}
      <div className="w-full max-w-screen-xl mx-auto">

        {/* heading centered */}
        <h1 className="text-xl font-bold text-center mb-4">Coupons</h1>

        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded shadow hover:bg-orange-600"
          >
            + Create Coupon
          </button>
        </div>

        {/* CREATE MODAL */}
        {showCreate && (
          <div className="fixed top-0 left-0 w-full h-full bg-black/40 flex justify-center items-center">
            <div className="bg-white p-6 rounded-lg w-96 shadow-lg">
              <h2 className="text-lg font-semibold mb-3">Create Coupon</h2>

              <input
                placeholder="Code"
                className="w-full border px-3 py-2 rounded mb-3"
                value={newCoupon.code}
                onChange={(e) =>
                  setNewCoupon({ ...newCoupon, code: e.target.value })
                }
              />

              <select
                className="w-full border px-3 py-2 rounded mb-3"
                value={newCoupon.discount_type}
                onChange={(e) =>
                  setNewCoupon({ ...newCoupon, discount_type: e.target.value })
                }
              >
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>

              <input
                placeholder="Discount value"
                type="number"
                className="w-full border px-3 py-2 rounded mb-3"
                value={newCoupon.discount_value}
                onChange={(e) =>
                  setNewCoupon({ ...newCoupon, discount_value: e.target.value })
                }
              />

              <input
                placeholder="Max uses"
                type="number"
                className="w-full border px-3 py-2 rounded mb-4"
                value={newCoupon.max_uses}
                onChange={(e) =>
                  setNewCoupon({ ...newCoupon, max_uses: e.target.value })
                }
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={createCoupon}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full table-fixed border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-sm">
                <th className="p-3 border w-12">ID</th>
                <th className="p-3 border">Code</th>
                <th className="p-3 border w-28">Type</th>
                <th className="p-3 border w-28">Value</th>
                <th className="p-3 border w-28">Max Uses</th>
                <th className="p-3 border w-20">Left</th>
                <th className="p-3 border">Status</th>
                <th className="p-3 border">Created</th>
                <th className="p-3 border w-20">Save</th>
              </tr>
            </thead>

            <tbody>
              {coupons.map((c) => {
                const isEdited =
                  edited[c.id] && Object.keys(edited[c.id]).length;

                return (
                  <tr key={c.id} className="border text-sm">
                    <td className="p-3 border break-words">{c.id}</td>

                    {/* Code */}
                    <td className="p-3 border">
                      <input
                        defaultValue={c.code}
                        onChange={(e) =>
                          setEdited((prev) => ({
                            ...prev,
                            [c.id]: { ...prev[c.id], code: e.target.value },
                          }))
                        }
                        className="border px-2 py-1 rounded w-full"
                      />
                    </td>

                    {/* Type */}
                    <td className="p-3 border">
                      <select
                        defaultValue={c.discount_type}
                        onChange={(e) =>
                          setEdited((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...prev[c.id],
                              discount_type: e.target.value,
                            },
                          }))
                        }
                        className="border px-2 py-1 rounded w-full"
                      >
                        {types.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </td>

                    {/* Value */}
                    <td className="p-3 border">
                      <input
                        type="number"
                        defaultValue={c.discount_value}
                        onChange={(e) =>
                          setEdited((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...prev[c.id],
                              discount_value: Number(e.target.value),
                            },
                          }))
                        }
                        className="border px-2 py-1 rounded w-full"
                      />
                    </td>

                    {/* Max Uses */}
                    <td className="p-3 border">
                      <input
                        type="number"
                        defaultValue={c.max_uses}
                        onChange={(e) =>
                          setEdited((prev) => ({
                            ...prev,
                            [c.id]: {
                              ...prev[c.id],
                              max_uses: Number(e.target.value),
                            },
                          }))
                        }
                        className="border px-2 py-1 rounded w-full"
                      />
                    </td>

                    <td className="p-3 border">{c.uses_left}</td>

                    {/* Status */}
                    <td className="p-3 border">
                      <select
                        defaultValue={c.status}
                        onChange={(e) =>
                          setEdited((prev) => ({
                            ...prev,
                            [c.id]: { ...prev[c.id], status: e.target.value },
                          }))
                        }
                        className={`border px-2 py-1 rounded w-full capitalize ${
                          c.status === "active"
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>

                    <td className="p-3 border">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>

                    {/* SAVE BUTTON */}
                    <td className="p-3 border text-center">
                      {isEdited ? (
                        <button
                          onClick={() => updateCoupon(c.id)}
                          className="bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600"
                        >
                          Save
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
