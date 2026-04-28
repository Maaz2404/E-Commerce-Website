"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { JwtPayload } from "@/components/NavBar";
import { useCartStore } from "@/store/cartStore";
import { useCouponStore, Coupon } from "@/store/couponStore";
import { formatCurrency } from "@/lib/format";

type PaymentMethod = {
  id: number;
  method_type: string;
  balance: number;
  created_at?: string;
  updated_at?: string | null;
};

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function OrderPage() {
  const router = useRouter();
  const { cart, clearCart } = useCartStore();
  const items = cart?.items ?? [];
  const total = cart?.total_price ?? items.reduce((s, it) => s + it.total, 0);

  // Coupon store
  const { activeCoupons } = useCouponStore();

  // Payment state
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [loadingPay, setLoadingPay] = useState(false);

  // Add method modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState<"wallet" | "card">("wallet");
  const [newMethodBalance, setNewMethodBalance] = useState<number | "">("");

  // Coupon + messages
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState<number>(0); // visual discount
  const [message, setMessage] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);

  // Auth check + redirect if no cart
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const decoded = jwtDecode<JwtPayload>(token);
      if (!decoded?.user_id) router.push("/login");
    } catch {
      router.push("/login");
    }
  }, [router]);

  // Fetch payment methods
  const fetchMethods = async () => {
    setLoadingMethods(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${baseURL}/payments/methods`, {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: json?.error ?? `Failed to load payment methods (${res.status})` });
        setMethods([]);
        setSelectedMethodId(null);
        return;
      }

      const fetched: any[] = json.methods ?? [];
      const normalized: PaymentMethod[] = fetched.map((m) => ({
        id: m[0] ?? m.id,
        method_type: m[1] ?? m.method_type,
        balance: Number(m[2] ?? m.balance ?? 0),
        created_at: m[3] ?? m.created_at,
        updated_at: m[4] ?? m.updated_at ?? null,
      }));

      setMethods(normalized);
      if (normalized.length > 0) setSelectedMethodId((prev) => prev ?? normalized[0].id);
      else setSelectedMethodId(null);
    } catch (err: any) {
      console.error("fetchMethods error:", err);
      setMessage({ type: "error", text: "Network error while fetching payment methods." });
    } finally {
      setLoadingMethods(false);
    }
  };

  useEffect(() => {
    if (!cart || items.length === 0) {
      router.push("/cart");
      return;
    }
    fetchMethods();
  }, [cart]);

  // Add new payment method
  const handleAddMethod = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage(null);
    if (!newMethodType) return setMessage({ type: "error", text: "Select a method type." });

    const token = localStorage.getItem("token");
    setLoadingMethods(true);

    try {
      const body = { method_type: newMethodType, balance: newMethodBalance === "" ? 0 : Number(newMethodBalance) };
      const res = await fetch(`${baseURL}/payments/methods/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) return setMessage({ type: "error", text: json?.error ?? `Failed to add method (${res.status})` });

      setMessage({ type: "success", text: json?.message ?? "Payment method added" });
      await fetchMethods();

      const returned = json?.method;
      if (returned) {
        const returnedId = Array.isArray(returned) ? returned[0] : returned.id;
        if (returnedId) setSelectedMethodId(Number(returnedId));
      }

      setShowAddModal(false);
      setNewMethodBalance("");
    } catch (err) {
      console.error("addMethod error:", err);
      setMessage({ type: "error", text: "Network error while adding payment method." });
    } finally {
      setLoadingMethods(false);
    }
  };

  // Apply coupon visually
  const handleApplyCoupon = () => {
  const entered = coupon.trim().toLowerCase();
  if (!entered) {
    setMessage({ type: "info", text: "No coupon entered" });
    setDiscount(0);
    return;
  }

  const found = activeCoupons.find((c: Coupon) => c.code.toLowerCase() === entered);
  if (!found) {
    setMessage({ type: "error", text: "Invalid coupon code" });
    setDiscount(0);
    return;
  }

  // Calculate discount
  let discountValue =
    found.discount_type === "percent"
      ? total * (found.discount_value / 100)
      : found.discount_value;

  // Ensure total never goes below 0
  discountValue = Math.min(discountValue, total);

  setDiscount(discountValue);
  setMessage({ type: "success", text: `Coupon applied: -${formatCurrency(discountValue)}` });
};


  // Make payment
  const handleConfirmPayment = async () => {
    setMessage(null);

    if (!selectedMethodId) return setMessage({ type: "error", text: "Select a payment method or add one." });

    const sel = methods.find((m) => m.id === selectedMethodId);
    if (sel && sel.balance < total - discount) {
      setMessage({ type: "error", text: `Insufficient balance (balance: ${formatCurrency(sel.balance)})` });
      return;
    }

    setLoadingPay(true);
    try {
      const token = localStorage.getItem("token");
      const body = { payment_method_id: selectedMethodId, coupon_code: coupon || null };
      const res = await fetch(`${baseURL}/payments/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) setMessage({ type: "error", text: json?.error ?? json?.message ?? `Payment failed (${res.status})` });
      else {
        setMessage({ type: "success", text: json?.message ?? "Payment successful!" });
        clearCart();
        setDiscount(0);
        setCoupon("");
      }
    } catch (err: any) {
      console.error("payment error:", err);
      setMessage({ type: "error", text: "Network error during payment." });
    } finally {
      setLoadingPay(false);
    }
  };

  const formattedTotal = useMemo(() => formatCurrency(total - discount), [total, discount]);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-slate-900 shadow-md rounded-lg text-slate-900 dark:text-slate-50">
      <h1 className="text-3xl font-bold mb-6 text-center">Order Summary</h1>

      {/* message */}
      {message && (
        <div
          className={`mb-4 text-center px-4 py-2 rounded ${
            message.type === "error"
              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"
              : "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* items */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400">No items in your cart.</p>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.item_id} className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-4">
                  <div>
                    <p className="font-semibold">{item.product_name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Qty: {item.quantity} • Price: {formatCurrency(item.price)}
                    </p>
                  </div>
                  <div className="font-semibold">{formatCurrency(item.total)}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-300 dark:border-slate-700 pt-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">Grand Total:</h2>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formattedTotal}</p>
            </div>
          </>
        )}
      </div>

      {/* payment method selector + add */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment method</label>
        <div className="flex gap-3 items-center">
          <select
            value={selectedMethodId ?? ""}
            onChange={(e) => setSelectedMethodId(e.target.value ? Number(e.target.value) : null)}
            disabled={loadingMethods || methods.length === 0}
            className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 w-full max-w-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50"
          >
            {loadingMethods ? (
              <option>Loading methods...</option>
            ) : methods.length === 0 ? (
              <option value="">No payment methods</option>
            ) : (
              <>
                <option value="">-- select method --</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.method_type} • {formatCurrency(m.balance)}
                  </option>
                ))}
              </>
            )}
          </select>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            Add method
          </button>
          <button
            type="button"
            onClick={fetchMethods}
            className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
            disabled={loadingMethods}
            title="Refresh methods"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* coupon */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Coupon (optional)</label>
        <div className="flex gap-3 items-center">
          <input
            value={coupon}
            onChange={(e) => {
              setCoupon(e.target.value);
              setDiscount(0);
            }}
            placeholder="Enter coupon code"
            className="border border-slate-300 dark:border-slate-600 rounded px-3 py-2 w-full max-w-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50"
          />
          <button
            type="button"
            onClick={handleApplyCoupon}
            className="border border-slate-300 dark:border-slate-600 px-3 py-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </div>

      {/* confirm */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleConfirmPayment}
          disabled={loadingPay}
          className={`px-8 py-3 rounded-lg text-xl font-semibold text-white ${
            loadingPay ? "bg-slate-400 cursor-not-allowed" : "bg-orange-500 hover:bg-orange-600"
          }`}
        >
          {loadingPay ? "Processing..." : `Pay ${formattedTotal}`}
        </button>
      </div>

      {/* Add method modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-50">Add Payment Method</h3>
            <form onSubmit={handleAddMethod} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select
                  value={newMethodType}
                  onChange={(e) => setNewMethodType(e.target.value as "wallet" | "card")}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50"
                >
                  <option value="wallet">Wallet</option>
                  <option value="card">Card</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Initial balance (optional)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={newMethodBalance}
                  onChange={(e) => setNewMethodBalance(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewMethodBalance("");
                  }}
                  className="px-4 py-2 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  {loadingMethods ? "Adding..." : "Add method"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
