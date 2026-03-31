import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { Package, Truck, MapPin, Clock, PhoneCall, CheckCircle, ArrowLeft } from "lucide-react";
import { initializeSocket, disconnectSocket } from "@/services/socket";

interface Order {
  id: number;
  status: string;
  totalPrice: number;
  hotel: { name: string; location: string };
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
  rider?: { name: string; phone: string };
}

const statusSteps = [
  { status: "Placed", label: "Order Placed", desc: "Your order has been received" },
  { status: "Accepted", label: "Accepted", desc: "Restaurant is confirming" },
  { status: "Preparing", label: "Preparing", desc: "Chef is cooking your food" },
  { status: "Ready", label: "Ready for Pickup", desc: "Food is packed and ready" },
  { status: "Out for Delivery", label: "Out for Delivery", desc: "Rider is on the way" },
  { status: "Delivered", label: "Delivered", desc: "Enjoy your meal!" },
];

function SkeletonTracking() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card-base animate-pulse space-y-3">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export default function OrderTracking() {
  const { orderId } = useParams();
  const { token } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);

    if (token && !socketRef.current) {
      socketRef.current = true;
      const socket = initializeSocket(token);
      socket.on("orderStatusUpdate", (data: { orderId: string; status: string }) => {
        if (data.orderId === orderId) fetchOrder();
      });
    }

    return () => {
      clearInterval(interval);
      disconnectSocket();
      socketRef.current = false;
    };
  }, [orderId, token]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(apiUrl(`/api/orders/${orderId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) setOrder(await response.json());
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <SkeletonTracking />
      </div>
    );
  }

  const currentStepIndex = statusSteps.findIndex((s) => s.status === order.status);
  const displayId = order.id ?? orderId;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm mb-4 transition-colors">
          <ArrowLeft size={16} /> Back to home
        </Link>

        {/* Order Header */}
        <div className="card-base mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Order #{String(displayId).slice(-8)}</p>
              <h1 className="text-xl font-extrabold mt-1">{order.hotel.name}</h1>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-primary">₹{order.totalPrice}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin size={14} /> {order.hotel.location}</span>
            <span className="flex items-center gap-1"><Clock size={14} /> {new Date(order.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="card-base mb-6">
          <h2 className="text-lg font-extrabold mb-6">Live Tracking</h2>

          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isLast = index === statusSteps.length - 1;

              return (
                <div key={step.status} className="flex gap-4 relative pb-8 last:pb-0">
                  {/* Connector line */}
                  {!isLast && (
                    <div className={`absolute left-[19px] top-10 w-0.5 h-[calc(100%-24px)] transition-colors duration-500
                      ${isCompleted ? "bg-primary" : "bg-border"}`}
                    />
                  )}

                  {/* Circle */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-500
                    ${isCompleted
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "bg-secondary text-muted-foreground border-2 border-border"
                    }
                    ${isCurrent ? "ring-4 ring-primary/20 animate-pulse" : ""}
                  `}>
                    {isCompleted ? <CheckCircle size={18} /> : <span className="text-sm font-bold">{index + 1}</span>}
                  </div>

                  {/* Info */}
                  <div className="pt-1.5">
                    <p className={`font-bold text-sm ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rider Info */}
        {order.rider && (
          <div className="card-base mb-6">
            <h3 className="text-base font-extrabold mb-3">Delivery Partner</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Truck size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-bold">{order.rider.name}</p>
                  <p className="text-sm text-muted-foreground">{order.rider.phone}</p>
                </div>
              </div>
              <a href={`tel:${order.rider.phone}`} className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors">
                <PhoneCall size={18} />
              </a>
            </div>
          </div>
        )}

        {/* Items Summary */}
        <div className="card-base">
          <h3 className="text-base font-extrabold mb-3">Order Items</h3>
          <div className="divide-y divide-border">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between py-2.5 text-sm">
                <span className="text-foreground">{item.name}</span>
                <span className="text-muted-foreground font-medium">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
