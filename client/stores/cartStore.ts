import { create } from "zustand";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  hotelId: string | null;
  hotelName: string | null;
  addItem: (item: CartItem, hotelId: string, hotelName: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  hotelId: null,
  hotelName: null,

  addItem: (item: CartItem, hotelId: string, hotelName: string) => {
    const state = get();
    
    // If cart has items from a different hotel, show warning (handled in component)
    if (state.hotelId && state.hotelId !== hotelId) {
      set({ items: [item], hotelId, hotelName });
      return;
    }

    const existingItem = state.items.find((i) => i.id === item.id);
    
    if (existingItem) {
      set({
        items: state.items.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        ),
      });
    } else {
      set({ items: [...state.items, item], hotelId, hotelName });
    }
  },

  removeItem: (id: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    }));
  },

  updateQuantity: (id: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }

    set((state) => ({
      items: state.items.map((i) =>
        i.id === id ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => {
    set({ items: [], hotelId: null, hotelName: null });
  },

  getTotal: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
