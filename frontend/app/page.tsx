"use client";

import ProductCard, { ProductInput } from "@/components/ProductCard";
import { useEffect, useState } from "react";
import { useCouponStore, Coupon } from "@/store/couponStore";

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function HomePage() {
  const [products, setProducts] = useState<ProductInput[]>([]);
  const { activeCoupons, setActiveCoupons } = useCouponStore();

  const [showCoupons, setShowCoupons] = useState(true);

  useEffect(() => {
    // Fetch products
    fetch(`${baseURL}/products`)
      .then((res) => res.json())
      .then((data) => setProducts(data?.products ?? []));

    // Fetch active coupons
    fetch(`${baseURL}/coupons/active`)
      .then((res) => res.json())
      .then((data) => setActiveCoupons(data?.active_coupons ?? []));
  }, []);

  return (
    <div className="pt-20 m-5 flex">
      {/* Products Grid */}
      <div className="flex-1 grid items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {products.map((product: ProductInput) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>

      {/* Floating Coupons Panel */}
      {showCoupons && activeCoupons.length > 0 && (
        <div className="fixed right-5 top-20 w-64 bg-white shadow-lg rounded-lg p-4 z-50">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-lg">Active Coupons</h2>
            <button
              className="text-gray-500 hover:text-gray-800"
              onClick={() => setShowCoupons(false)}
            >
              ✕
            </button>
          </div>
          <div className="space-y-2">
            {activeCoupons.map((c: Coupon) => (
              <div
                key={c.id}
                className="bg-orange-100 p-2 rounded-md hover:bg-orange-200 cursor-pointer"
                onClick={() => navigator.clipboard.writeText(c.code)}
              >
                <p className="font-semibold">{c.code}</p>
                <p className="text-sm text-gray-700">
                  {c.discount_type === "percent"
                    ? `${c.discount_value}% off`
                    : `$${c.discount_value} off`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
