import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import { ShoppingBag, MapPin, Pencil, Check, X } from "lucide-react";

interface Order {
  id: number;
  hotel: { name: string };
  totalPrice: number;
  status: string;
  createdAt: string;
}

export default function UserDashboard() {
  const { user, token, updateAddress } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const fetchOrders = async () => {
    try {
      const response = await fetch(apiUrl("/api/orders/my-orders"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    setAddressSaving(true);
    try {
      const res = await fetch(apiUrl("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: addressInput }),
      });
      if (res.ok) {
        updateAddress(addressInput);
        setEditingAddress(false);
      }
    } catch (e) {
      console.error("Error saving address:", e);
    } finally {
      setAddressSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Section */}
          <div className="card-base mb-8 bg-gradient-to-r from-primary/10 to-accent/10">
            <h1 className="text-3xl font-bold mb-2">Welcome, {user?.name}!</h1>
            <p className="text-muted-foreground">Manage your orders and account here</p>
          </div>

          {/* Delivery Address Card (Swiggy-style) */}
          <div className="card-base mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                <h3 className="text-lg font-bold">Delivery Address</h3>
              </div>
              {!editingAddress && (
                <button
                  onClick={() => { setAddressInput(user?.address || ""); setEditingAddress(true); }}
                  className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline"
                >
                  <Pencil size={14} /> {user?.address ? "Change" : "Add Address"}
                </button>
              )}
            </div>

            {editingAddress ? (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="House no., street, area, city..."
                  className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveAddress}
                    disabled={addressSaving || !addressInput.trim()}
                    className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
                  >
                    <Check size={15} /> {addressSaving ? "Saving..." : "Save Address"}
                  </button>
                  <button
                    onClick={() => setEditingAddress(false)}
                    className="btn-secondary flex items-center gap-2 px-5 py-2 text-sm"
                  >
                    <X size={15} /> Cancel
                  </button>
                </div>
              </div>
            ) : user?.address ? (
              <p className="text-sm text-foreground bg-secondary rounded-xl px-4 py-3">{user.address}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No address saved. Add your delivery address so you don't have to type it every time.</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <Link
              to="/"
              className="card-base text-center hover:shadow-lg transition-shadow cursor-pointer p-6"
            >
              <div className="text-4xl mb-3">🍽️</div>
              <h3 className="font-bold text-lg">Order Food</h3>
              <p className="text-sm text-muted-foreground">Browse restaurants</p>
            </Link>
            <Link
              to="/"
              className="card-base text-center hover:shadow-lg transition-shadow cursor-pointer p-6"
            >
              <div className="text-4xl mb-3">📍</div>
              <h3 className="font-bold text-lg">Track Orders</h3>
              <p className="text-sm text-muted-foreground">Real-time updates</p>
            </Link>
          </div>

          {/* Orders Section */}
          <div className="card-base">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingBag size={24} className="text-primary" />
              <h2 className="text-2xl font-bold">Your Orders</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/order/${order.id}`}
                    className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Restaurant</p>
                        <p className="font-semibold">{order.hotel?.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold text-primary">₹{order.totalPrice}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        <p className="font-semibold text-accent">{order.status}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-semibold">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📦</div>
                <p className="text-muted-foreground mb-4">No orders yet</p>
                <Link to="/" className="btn-primary">
                  Start Ordering
                </Link>
              </div>
            )}
          </div>

          {/* Account Info */}
          <div className="card-base mt-8">
            <h3 className="text-lg font-bold mb-4">Account Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between pb-4 border-b border-border">
                <span className="text-muted-foreground">Email</span>
                <span className="font-semibold">{user?.email}</span>
              </div>
              <div className="flex justify-between pb-4 border-b border-border">
                <span className="text-muted-foreground">Account Type</span>
                <span className="font-semibold capitalize">Customer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
