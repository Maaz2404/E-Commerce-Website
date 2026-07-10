import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  item_id: number;
  product_name: string;
  product_id: number;
  price: number;
  quantity: number;
  total: number;
}

export interface Cart {
  cart_id: number;
  items: CartItem[];
  total_price: number;
}

interface CartState {
  cart: Cart | null;
  setCart: (cart: Cart) => void;
  removeItem: (itemId: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: null,

      setCart: (cart) => set({ cart }),

      removeItem: (itemId) => {
        const curr = get().cart;
        if (!curr) return;

        const updatedItems = curr.items.filter(
          (i) => i.product_id !== itemId
        );

        const updatedPrice = updatedItems.reduce(
          (sum, i) => sum + i.total,
          0
        );

        set({
          cart: {
            ...curr,
            items: updatedItems,
            total_price: updatedPrice,
          },
        });
      },

      clearCart: () => set({ cart: null }),
    }),
    { name: "cart-storage" }
  )
);
