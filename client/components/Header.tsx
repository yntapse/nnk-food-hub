import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, LogOut, User, Menu, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";

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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-primary to-orange-500 rounded-xl flex items-center justify-center text-white text-lg shadow-md shadow-primary/25">
            🍔
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            <span className="text-primary">Niphad </span>
            <span className="text-foreground">Food Hub</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard" className="btn-ghost text-sm flex items-center gap-1.5">
                <User size={16} />
                Dashboard
              </Link>
              {user.role === "user" && (
                <Link to="/cart" className="btn-ghost text-sm flex items-center gap-1.5 relative">
                  <ShoppingCart size={16} />
                  Cart
                  {itemCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce-in">
                      {itemCount}
                    </span>
                  )}
                </Link>
              )}
              <div className="w-px h-6 bg-border mx-1" />
              <button onClick={handleLogout} className="btn-ghost text-sm flex items-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">
                <LogOut size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm font-semibold">
                Login
              </Link>
              <Link to="/signup" className="btn-primary text-sm py-2.5 px-5 rounded-xl">
                Sign Up
              </Link>
            </>
          )}
        </nav>

        {/* Mobile: cart + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user?.role === "user" && (
            <Link to="/cart" className="relative p-2">
              <ShoppingCart size={22} className="text-foreground" />
              {itemCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-border animate-slide-up">
          <div className="px-4 py-4 space-y-1">
            {user ? (
              <>
                <div className="px-3 py-2 mb-2">
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="font-semibold text-foreground">{user.name}</p>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition-colors"
                >
                  <User size={18} /> Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} /> Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-outline w-full text-center">
                  Login
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)} className="btn-primary w-full text-center">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
