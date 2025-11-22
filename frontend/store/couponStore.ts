import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_uses: number;
  uses_left: number;
  status: string;
  created_at: string;
}

interface CouponState {
  activeCoupons: Coupon[];
  setActiveCoupons: (coupons: Coupon[]) => void;
  clearCoupons: () => void;
}

export const useCouponStore = create<CouponState>()(
  persist(
    (set) => ({
      activeCoupons: [],
      setActiveCoupons: (coupons) => set({ activeCoupons: coupons }),
      clearCoupons: () => set({ activeCoupons: [] }),
    }),
    { name: "coupon-storage" }
  )
);
