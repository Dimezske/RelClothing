import { createContext, useContext, useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";

type CartContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const cartQuery = trpc.cart.list.useQuery();

  const itemCount = (cartQuery.data ?? []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartUI() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartUI must be used within CartProvider");
  return ctx;
}
