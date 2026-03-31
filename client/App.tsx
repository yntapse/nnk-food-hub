import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Restaurant from "./pages/Restaurant";
import Cart from "./pages/Cart";
import OrderTracking from "./pages/OrderTracking";
import UserDashboard from "./pages/dashboards/UserDashboard";
import HotelDashboard from "./pages/dashboards/HotelDashboard";
import RiderDashboard from "./pages/dashboards/RiderDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import NotFound from "./pages/NotFound";
import { useAuthStore } from "./stores/authStore";
import { useEffect } from "react";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, role }: { children: React.ReactNode; role?: string }) => {
  const { user } = useAuthStore();

  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;

  return children;
};

// Separate component to avoid hooks-in-callback violation
const DashboardRoute = () => {
  const { user } = useAuthStore();

  if (user?.role === "user") return <UserDashboard />;
  if (user?.role === "hotel") return <HotelDashboard />;
  if (user?.role === "rider") return <RiderDashboard />;
  if (user?.role === "admin") return <AdminDashboard />;
  return <Navigate to="/" />;
};

const App = () => {
  useEffect(() => {
    useAuthStore.getState().loadFromStorage();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/restaurant/:hotelId" element={<Restaurant />} />

            {/* User Routes */}
            <Route
              path="/cart"
              element={
                <ProtectedRoute role="user">
                  <Cart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/order/:orderId"
              element={
                <ProtectedRoute role="user">
                  <OrderTracking />
                </ProtectedRoute>
              }
            />

            {/* Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardRoute />
                </ProtectedRoute>
              }
            />

            {/* Catch All */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
