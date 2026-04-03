import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/Header";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import { useAuthStore } from "@/stores/authStore";
import { apiUrl } from "@/lib/api";
import { Truck, Wallet, MapPin, Bell, Navigation, Route, PhoneCall, KeyRound, X } from "lucide-react";
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

function createMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function createDirectionsUrl(origin: string, destination: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/** Plays a repeating alert ringtone using the Web Audio API. Returns a stop function. */
function startRingtone(): () => void {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout>;

  const playBeep = () => {
    if (stopped) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
    if (!stopped) timeoutId = setTimeout(playBeep, 1200);
  };

  playBeep();

  return () => {
    stopped = true;
    clearTimeout(timeoutId);
    ctx.close();
  };
}

export default function RiderDashboard() {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [earnings, setEarnings] = useState({ totalEarnings: 0, completedDeliveries: 0, activeDeliveries: 0 });
  const [loading, setLoading] = useState(true);
  const [newAssignment, setNewAssignment] = useState(false);
  // OTP state: orderId → value entered by rider
  const [otpInputs, setOtpInputs] = useState<Record<number, string>>({});
  const [otpError, setOtpError] = useState<Record<number, string>>({});
  const [completingId, setCompletingId] = useState<number | null>(null);
  const socketRef = useRef(false);
  const stopRingtoneRef = useRef<(() => void) | null>(null);

  const stopRingtone = useCallback(() => {
    if (stopRingtoneRef.current) {
      stopRingtoneRef.current();
      stopRingtoneRef.current = null;
    }
    setNewAssignment(false);
  }, []);

  useEffect(() => {
    fetchData();

    if (token && !socketRef.current) {
      socketRef.current = true;
      const socket = initializeSocket(token);
      socket.on("orderAssigned", () => {
        setNewAssignment(true);
        fetchData();
        // Start ringtone — will loop until rider dismisses / accepts
        stopRingtoneRef.current?.(); // stop any previous
        stopRingtoneRef.current = startRingtone();
      });
    }

    return () => {
      disconnectSocket();
      socketRef.current = false;
      stopRingtoneRef.current?.();
      stopRingtoneRef.current = null;
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
        stopRingtone(); // stop ringtone when order accepted
        fetchData();
      }
    } catch (error) {
      console.error("Error accepting delivery:", error);
    }
  };

  const completeDelivery = async (orderId: number) => {
    const otp = otpInputs[orderId]?.trim();
    if (!otp) {
      setOtpError((prev) => ({ ...prev, [orderId]: "Please enter the OTP from the customer" }));
      return;
    }
    setCompletingId(orderId);
    setOtpError((prev) => ({ ...prev, [orderId]: "" }));
    try {
      const response = await fetch(apiUrl(`/api/rider/complete/${orderId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp }),
      });

      if (response.ok) {
        setOtpInputs((prev) => { const n = { ...prev }; delete n[orderId]; return n; });
        fetchData();
      } else {
        const data = await response.json();
        setOtpError((prev) => ({ ...prev, [orderId]: data.error || "OTP verification failed" }));
      }
    } catch (error) {
      console.error("Error completing delivery:", error);
      setOtpError((prev) => ({ ...prev, [orderId]: "Network error. Try again." }));
    } finally {
      setCompletingId(null);
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
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20 text-sm animate-pulse">
                  <Bell size={16} className="animate-bounce" />
                  <span className="font-semibold">New delivery assigned!</span>
                  <button onClick={stopRingtone} className="ml-1 p-0.5 rounded hover:bg-primary/20" title="Dismiss">
                    <X size={14} />
                  </button>
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

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                    <GoogleMapEmbed
                      query={`${order.hotel.name}, ${order.hotel.location}`}
                      title="Hotel location"
                      heightClassName="h-44"
                    />
                    <GoogleMapEmbed
                      query={order.user.address}
                      title="Customer location"
                      heightClassName="h-44"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <a
                      href={createMapsSearchUrl(`${order.hotel.name}, ${order.hotel.location}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-border text-sm font-semibold hover:border-primary/40"
                    >
                      <Navigation size={14} /> Hotel
                    </a>
                    <a
                      href={createMapsSearchUrl(order.user.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-border text-sm font-semibold hover:border-primary/40"
                    >
                      <Navigation size={14} /> Customer
                    </a>
                    <a
                      href={createDirectionsUrl(`${order.hotel.name}, ${order.hotel.location}`, order.user.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:brightness-110"
                    >
                      <Route size={14} /> Hotel to Customer
                    </a>
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
                      <a href={`tel:${order.user.phone}`} className="text-sm inline-flex items-center gap-1 hover:text-primary">
                        <PhoneCall size={13} /> {order.user.phone}
                      </a>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-accent/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Delivery Address</p>
                    <p className="text-sm font-semibold">{order.user.address}</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
                    <GoogleMapEmbed
                      query={`${order.hotel.name}, ${order.hotel.location}`}
                      title="Pickup location"
                      heightClassName="h-44"
                    />
                    <GoogleMapEmbed
                      query={order.user.address}
                      title="Drop location"
                      heightClassName="h-44"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    <a
                      href={createMapsSearchUrl(`${order.hotel.name}, ${order.hotel.location}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-border text-sm font-semibold hover:border-primary/40"
                    >
                      <Navigation size={14} /> Navigate to Hotel
                    </a>
                    <a
                      href={createMapsSearchUrl(order.user.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary border border-border text-sm font-semibold hover:border-primary/40"
                    >
                      <Navigation size={14} /> Navigate to Customer
                    </a>
                    <a
                      href={createDirectionsUrl(`${order.hotel.name}, ${order.hotel.location}`, order.user.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:brightness-110"
                    >
                      <Route size={14} /> Get Directions
                    </a>
                  </div>

                  <div className="flex gap-2 justify-between items-start flex-wrap">
                    <p className="text-sm font-semibold pt-1">
                      Status: <span className="text-accent">{order.status}</span>
                    </p>

                    {/* OTP verification block */}
                    <div className="flex flex-col gap-1 min-w-[240px]">
                      <label className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <KeyRound size={12} /> Ask customer for OTP to confirm delivery
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="4-digit OTP"
                          value={otpInputs[order.id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                            setOtpInputs((prev) => ({ ...prev, [order.id]: val }));
                            if (otpError[order.id]) setOtpError((prev) => ({ ...prev, [order.id]: "" }));
                          }}
                          className="w-28 px-3 py-2 border border-border rounded-lg text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => completeDelivery(order.id)}
                          disabled={completingId === order.id}
                          className="btn-primary py-2 px-4 disabled:opacity-60"
                        >
                          {completingId === order.id ? "Verifying..." : "Deliver"}
                        </button>
                      </div>
                      {otpError[order.id] && (
                        <p className="text-xs text-destructive font-medium">{otpError[order.id]}</p>
                      )}
                    </div>
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
