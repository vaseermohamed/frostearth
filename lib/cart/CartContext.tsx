"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface CartItem {
  productId: string;
  title: string;
  priceInPaise: number;
  coverImageKey: string | null;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  totalInPaise: number;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cart is scoped per store slug (storageKey) and lives in localStorage —
 * this is a normal client-side web app (not a Claude artifact sandbox),
 * so localStorage is the right tool here: it survives page navigation
 * between product pages and a closed/reopened tab, which React state
 * alone wouldn't.
 */
export function CartProvider({ storeSlug, children }: { storeSlug: string; children: ReactNode }) {
  const storageKey = `frostearth-cart-${storeSlug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupt/inaccessible storage — cart just starts empty
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return; // don't overwrite storage with the initial empty state before hydration runs
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, storageKey, hydrated]);

  function addItem(item: CartItem) {
    setItems((prev) => (prev.some((i) => i.productId === item.productId) ? prev : [...prev, item]));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clear() {
    setItems([]);
  }

  const totalInPaise = items.reduce((sum, i) => sum + i.priceInPaise, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clear, totalInPaise }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
