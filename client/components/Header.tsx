import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, LogOut, User, Menu, X, MapPin } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { motion, AnimatePresence } from "framer-motion";

export default function Header() {
  const { user, logout } = useAuthStore();
  const itemCount = useCartStore((s) => s.getItemCount());
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-white/97 backdrop-blur-xl border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <img
            src="/niphad-bites-logo2.png"
            alt="Niphad Bites logo"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover shadow-lg shadow-primary/20 border border-orange-100 shrink-0"
          />
          <div className="block min-w-0">
            <span className="block font-extrabold text-base sm:text-xl tracking-tight leading-none truncate">
              <span className="text-primary">Niphad </span>
              <span className="text-gray-900">Bites</span>
            </span>
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 font-medium mt-1">
              <MapPin size={11} /> Niphad, Maharashtra
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1.5">
          {user ? (
            <>
              <Link to="/dashboard" className="btn-ghost text-sm flex items-center gap-1.5">
                <User size={15} /> Dashboard
              </Link>
              {user.role === "user" && (
                <Link to="/cart" className="btn-ghost text-sm flex items-center gap-1.5 relative">
                  <ShoppingCart size={15} /> Cart
                  {itemCount > 0 && (
                    <motion.span
                      key={itemCount}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                    >
                      {itemCount}
                    </motion.span>
                  )}
                </Link>
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button onClick={handleLogout} className="btn-ghost text-sm flex items-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">
                <LogOut size={15} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm font-semibold">Login</Link>
              <Link to="/signup" className="btn-primary text-sm py-2 px-4 rounded-xl">Sign Up</Link>
            </>
          )}
        </nav>

        {/* Mobile: cart badge + hamburger */}
        <div className="flex md:hidden items-center gap-1">
          {user?.role === "user" && (
            <Link to="/cart" className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ShoppingCart size={20} className="text-gray-700" />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} className="text-gray-700" /> : <Menu size={20} className="text-gray-700" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className="md:hidden bg-white border-t border-gray-100 shadow-lg"
          >
            <div className="px-4 py-3 space-y-1">
              {user ? (
                <>
                  <div className="px-3 py-2.5 mb-1 bg-orange-50 rounded-xl">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="font-extrabold text-gray-900 text-sm">{user.name}</p>
                    <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold capitalize">{user.role}</span>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold"
                  >
                    <User size={17} className="text-gray-500" /> Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors text-sm font-semibold"
                  >
                    <LogOut size={17} /> Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 py-1">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-outline w-full text-center text-sm py-3">
                    Login
                  </Link>
                  <Link to="/signup" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-center text-sm py-3">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
