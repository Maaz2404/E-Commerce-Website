"use client";

import ProductCard, { ProductInput } from "@/components/ProductCard";
import ChatWidget from "@/components/ChatWidget";
import { useCouponStore, Coupon } from "@/store/couponStore";
import { formatCurrency } from "@/lib/format";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

function HomePageContent() {
  const [products, setProducts] = useState<ProductInput[]>([]);
  const { activeCoupons, setActiveCoupons } = useCouponStore();
  const searchParams = useSearchParams();

  const [showCoupons, setShowCoupons] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Bakery", "Beverages", "Snacks", "Dairy"];
  const searchQuery = (searchParams.get("search") ?? "").trim().toLowerCase();

  useEffect(() => {
    fetch(`${baseURL}/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data?.products ?? []))
      .catch((err) => console.error("Products fetch error:", err));

    fetch(`${baseURL}/coupons/active`)
      .then((res) => res.json())
      .then((data) => setActiveCoupons(data?.active_coupons ?? []))
      .catch((err) => console.error("Coupons fetch error:", err));
  }, [setActiveCoupons]);

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "All" || product.category === selectedCategory;

    const searchableContent = [
      product.name,
      product.description,
      product.category,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchQuery || searchableContent.includes(searchQuery);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="px-4 pb-10 pt-6 md:px-6">
      <div className="mx-auto flex max-w-7xl gap-6">
        <div className="flex-1">
          <section className="mb-6 rounded-[2rem] border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-amber-50 px-6 py-8 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                  Easy Shopping
                </p>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
                  Find essentials faster, now with an even smoother experience.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                  Browse by category, search by name, and get help quickly if you need it.
                  For direct support, call{" "}
                  <span className="font-semibold text-slate-950 dark:text-white">03122417654</span>.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Search status
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                    {searchQuery ? `Results for "${searchQuery}"` : "Showing all products"}
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white/80 px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Need help?
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                    Call 03122417654
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6 flex flex-col gap-3 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">Filter products</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Choose a category to reduce clutter and find items faster.
              </p>
            </div>

            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span>Category</span>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="rounded-full border border-sky-200 bg-slate-50 px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {filteredProducts.length} product{filteredProducts.length === 1 ? "" : "s"} found
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-sky-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white">No products match this filter yet.</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Try a different search or switch back to <span className="font-semibold">All</span> categories.
              </p>
            </div>
          ) : (
            <div className="grid items-stretch grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>
          )}
        </div>

        {showCoupons && activeCoupons.length > 0 && (
          <div className="fixed right-5 top-24 z-40 hidden w-72 rounded-3xl border border-sky-100 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 xl:block">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Coupons</h2>
              <button
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                onClick={() => setShowCoupons(false)}
                aria-label="Hide active coupons"
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Tap any coupon to copy it before checkout.
            </p>
            <div className="space-y-2">
              {activeCoupons.map((coupon: Coupon) => (
                <div
                  key={coupon.id}
                  className="cursor-pointer rounded-2xl border border-sky-100 bg-sky-50 p-3 transition hover:border-amber-200 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
                  onClick={() => navigator.clipboard.writeText(coupon.code)}
                >
                  <p className="font-semibold text-sky-700 dark:text-sky-300">{coupon.code}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {coupon.discount_type === "percent"
                      ? `${coupon.discount_value}% off`
                      : `${formatCurrency(coupon.discount_value)} off`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ChatWidget />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
      <HomePageContent />
    </Suspense>
  );
}
