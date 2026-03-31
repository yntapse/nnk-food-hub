import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { apiUrl } from "@/lib/api";
import { Truck, Wallet, MapPin, Bell } from "lucide-react";
import { initializeSocket, disconnectSocket } from "@/services/socket";

interface Order {
  id: number;
  hotel: { name: string; location: string };
  user: { name: string; phone: string; address: string };
  status: string;
  totalPrice: number;
  createdAt: string;
}

interface RiderProfile {
  id: number;
  name: string;
  email: string;
  isOnline: boolean;
  isAvailable: boolean;
  totalEarnings: number;
  currentOrders: string[];
}

export default function RiderDashboard() {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState({ totalEarnings: 0, completedDeliveries: 0, activeDeliveries: 0 });
  const [loading, setLoading] = useState(true);
  const [newAssignment, setNewAssignment] = useState(false);
  const socketRef = useRef(false);

  useEffect(() => {
    fetchData();

    if (token && !socketRef.current) {
      socketRef.current = true;
      const socket = initializeSocket(token);
      socket.on("orderAssigned", () => {
        setNewAssignment(true);
        fetchData();
      });
    }

    return () => {
      disconnectSocket();
      socketRef.current = false;
    };
  }, [token]);

  const fetchData = async () => {
    try {
      const [profileRes, ordersRes, earningsRes] = await Promise.all([
        fetch(apiUrl("/api/rider/profile"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/rider/orders"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/rider/earnings"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (profileRes.ok) setProfile(await profileRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (earningsRes.ok) setEarnings(await earningsRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    try {
      const response = await fetch(apiUrl("/api/rider/status"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isOnline: !profile?.isOnline }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const acceptDelivery = async (orderId: number) => {
    try {
      const response = await fetch(apiUrl(`/api/rider/accept/${orderId}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error accepting delivery:", error);
    }
  };

  const completeDelivery = async (orderId: number) => {
    try {
      const response = await fetch(apiUrl(`/api/rider/complete/${orderId}`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error completing delivery:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status === "Out for Delivery" || o.status === "Picked Up");
  const availableOrders = orders.filter((o) => o.status === "Ready");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header with Status Toggle */}
        <div className="mb-8 card-base">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Delivery Dashboard</h1>
              <p className="text-muted-foreground">Welcome, {profile?.name}!</p>
            </div>
            <div className="flex items-center gap-3">
              {newAssignment && (
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20 text-sm">
                  <Bell size={16} className="animate-bounce" />
                  <span className="font-semibold">New delivery!</span>
                  <button onClick={() => setNewAssignment(false)} className="text-xs underline">OK</button>
                </div>
              )}
              <button
              onClick={toggleOnline}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                profile?.isOnline
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {profile?.isOnline ? "🟢 Online" : "🔴 Offline"}
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-base">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-3xl font-bold text-primary">₹{earnings.totalEarnings}</p>
              </div>
              <Wallet size={32} className="text-primary opacity-50" />
            </div>
          </div>
          <div className="card-base">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Deliveries</p>
                <p className="text-3xl font-bold">{earnings.activeDeliveries}</p>
              </div>
              <Truck size={32} className="text-orange-500 opacity-50" />
            </div>
          </div>
          <div className="card-base">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-accent">{earnings.completedDeliveries}</p>
              </div>
              <Truck size={32} className="text-accent opacity-50" />
            </div>
          </div>
        </div>

        {/* Available Orders to Pickup */}
        {availableOrders.length > 0 && profile?.isOnline && (
          <div className="card-base mb-8">
            <h2 className="text-2xl font-bold mb-4">📦 Available Pickups</h2>
            <div className="space-y-4">
              {availableOrders.map((order) => (
                <div key={order.id} className="p-4 border border-border rounded-lg bg-orange-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Restaurant</p>
                      <p className="font-semibold">{order.hotel.name}</p>
                      <div className="flex items-center gap-1 text-sm mt-1 text-muted-foreground">
                        <MapPin size={14} />
                        {order.hotel.location}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deliver to</p>
                      <p className="font-semibold">{order.user.name}</p>
                      <p className="text-sm text-muted-foreground">{order.user.address}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => acceptDelivery(order.id)}
                    className="btn-primary w-full"
                  >
                    Accept Delivery
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Deliveries */}
        <div className="card-base">
          <h2 className="text-2xl font-bold mb-6">🚴 Active Deliveries</h2>

          {activeOrders.length > 0 ? (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <div key={order.id} className="p-4 border-2 border-accent rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">From</p>
                      <p className="font-semibold">{order.hotel.name}</p>
                      <div className="flex items-center gap-1 text-sm mt-1 text-muted-foreground">
                        <MapPin size={14} />
                        {order.hotel.location}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Deliver to</p>
                      <p className="font-semibold">{order.user.name}</p>
                      <p className="text-sm">Phone: {order.user.phone}</p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-accent/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Delivery Address</p>
                    <p className="text-sm font-semibold">{order.user.address}</p>
                  </div>

                  <div className="flex gap-2 justify-between items-center">
                    <p className="text-sm font-semibold">
                      Status: <span className="text-accent">{order.status}</span>
                    </p>
                    <button
                      onClick={() => completeDelivery(order.id)}
                      className="btn-primary py-2 px-4"
                    >
                      Mark Delivered
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {profile?.isOnline ? "No active deliveries. Accept one to get started!" : "Go online to accept deliveries"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
