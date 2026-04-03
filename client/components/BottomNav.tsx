import { Link, useLocation } from "react-router-dom";
import { Home, UtensilsCrossed, ShoppingCart, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function BottomNav() {
  const location = useLocation();
  const { user } = useAuthStore();
  const itemCount = useCartStore((s) => s.getItemCount());

  const items = [
    { to: "/", label: "Home", icon: Home },
    { to: "/", label: "Restaurants", icon: UtensilsCrossed },
    {
      to: user?.role === "user" ? "/cart" : user ? "/dashboard" : "/login",
      label: user?.role === "user" ? "Cart" : "Orders",
      icon: ShoppingCart,
      badge: user?.role === "user" ? itemCount : 0,
    },
    {
      to: user ? "/dashboard" : "/login",
      label: user ? "Profile" : "Login",
      icon: User,
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/97 backdrop-blur-xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16">
        {items.map(({ to, label, icon: Icon, badge }) => {
          const isActive =
            to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(to);

          return (
            <Link
              key={label}
              to={to}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group"
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}

              <div className="relative">
                <Icon
                  size={22}
                  className={cn(
                    "transition-all duration-200",
                    isActive
                      ? "text-primary scale-110"
                      : "text-gray-400 group-active:scale-90"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {(badge ?? 0) > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {(badge ?? 0) > 9 ? "9+" : badge}
                  </motion.span>
                )}
              </div>

              <span
                className={cn(
                  "text-[10px] font-semibold transition-colors",
                  isActive ? "text-primary" : "text-gray-400"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
