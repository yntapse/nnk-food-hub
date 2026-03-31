import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "user" | "rider" | "hotel" | "admin";
  address?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User, token: string) => void;
  updateAddress: (address: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setUser: (user: User, token: string) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", token);
    set({ user, token });
  },

  updateAddress: (address: string) => {
    set((state) => {
      if (!state.user) return state;
      const updated = { ...state.user, address };
      localStorage.setItem("user", JSON.stringify(updated));
      return { user: updated };
    });
  },

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    set({ user: null, token: null });
  },

  loadFromStorage: () => {
    const user = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (user && token) {
      set({ user: JSON.parse(user), token });
    }
  },
}));

// Load from storage on app start
useAuthStore.getState().loadFromStorage();
