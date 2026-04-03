import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { apiUrl } from "@/lib/api";
import { Users, Bike, ShoppingBag, TrendingUp, Trash2, IndianRupee, Check, PauseCircle, PlayCircle, Pencil } from "lucide-react";

interface Analytics {
  totalUsers: number;
  totalRiders: number;
  totalHotels: number;
  totalOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  onlineRiders: number;
}

interface DeliveryFeeSettings {
  deliveryFeeAmount: number;
  freeDeliveryThreshold: number;
  firstOrderFree: boolean;
}

interface Rider {
  id: number;
  name: string;
  email: string;
  phone: string;
  isOnline: boolean;
  isAvailable: boolean;
}

interface Hotel {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  category: string;
  rating: number;
  isOpen: boolean;
}

interface Order {
  id: number;
  user: { name: string; phone: string };
  hotel: { name: string };
  rider?: { name: string; phone: string };
  status: string;
  totalPrice: number;
  createdAt: string;
}

export default function AdminDashboard() {
  const { token } = useAuthStore();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"analytics" | "orders" | "riders" | "hotels">("analytics");
  const [riderForm, setRiderForm] = useState({
    name: "", email: "", phone: "", password: "",
  });
  const [adminUpiId, setAdminUpiId] = useState("");
  const [adminUpiSaving, setAdminUpiSaving] = useState(false);
  const [adminUpiSaved, setAdminUpiSaved] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<DeliveryFeeSettings>({
    deliveryFeeAmount: 30,
    freeDeliveryThreshold: 200,
    firstOrderFree: true,
  });
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [deliverySaved, setDeliverySaved] = useState(false);
  const [hotelForm, setHotelForm] = useState({
    name: "", email: "", phone: "", password: "", location: "", category: "Fast Food", rating: "4.5",
  });
  const [availableRiders, setAvailableRiders] = useState<Rider[]>([]);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [editRiderForm, setEditRiderForm] = useState({ name: "", phone: "", password: "" });
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [editHotelForm, setEditHotelForm] = useState({ name: "", phone: "", location: "", category: "", password: "", rating: "4.5" });

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [analyticsRes, ridersRes, hotelsRes, ordersRes, adminUpiRes, deliverySettingsRes] = await Promise.all([
        fetch(apiUrl("/api/admin/analytics"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/riders"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/hotels"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/orders"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/upi"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/api/admin/delivery-settings"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (ridersRes.ok) {
        const riderData = await ridersRes.json();
        setRiders(riderData);
        setAvailableRiders(riderData.filter((r: Rider) => r.isOnline));
      }
      if (hotelsRes.ok) setHotels(await hotelsRes.json());
      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (adminUpiRes.ok) { const d = await adminUpiRes.json(); setAdminUpiId(d.upiId || ""); }
      if (deliverySettingsRes.ok) setDeliverySettings(await deliverySettingsRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAdminUpi = async () => {
    setAdminUpiSaving(true);
    try {
      const res = await fetch(apiUrl("/api/admin/upi"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upiId: adminUpiId }),
      });
      if (res.ok) { setAdminUpiSaved(true); setTimeout(() => setAdminUpiSaved(false), 3000); }
    } catch (e) {
      console.error("Error saving admin UPI:", e);
    } finally {
      setAdminUpiSaving(false);
    }
  };

  const handleSaveDeliverySettings = async () => {
    setDeliverySaving(true);
    try {
      const res = await fetch(apiUrl("/api/admin/delivery-settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(deliverySettings),
      });
      if (res.ok) {
        const data = await res.json();
        setDeliverySettings(data.settings);
        setDeliverySaved(true);
        setTimeout(() => setDeliverySaved(false), 3000);
      }
    } catch (e) {
      console.error("Error saving delivery settings:", e);
    } finally {
      setDeliverySaving(false);
    }
  };

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/admin/riders"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(riderForm),
      });
      if (response.ok) {
        setRiderForm({ name: "", email: "", phone: "", password: "" });
        fetchData();
      }
    } catch (error) {
      console.error("Error creating rider:", error);
    }
  };

  const handleCreateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/admin/hotels"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...hotelForm, rating: parseFloat(hotelForm.rating) }),
      });
      if (response.ok) {
        setHotelForm({ name: "", email: "", phone: "", password: "", location: "", category: "Fast Food", rating: "4.5" });
        fetchData();
      }
    } catch (error) {
      console.error("Error creating hotel:", error);
    }
  };

  const handleDeleteRider = async (riderId: number) => {
    if (!confirm("Delete this rider?")) return;
    try {
      await fetch(apiUrl(`/api/admin/riders/${riderId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting rider:", error);
    }
  };

  const handleDeleteHotel = async (hotelId: number) => {
    if (!confirm("Delete this hotel?")) return;
    try {
      await fetch(apiUrl(`/api/admin/hotels/${hotelId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch (error) {
      console.error("Error deleting hotel:", error);
    }
  };

  const handleAssignRider = async (orderId: number, riderId: string) => {
    try {
      await fetch(apiUrl(`/api/admin/orders/${orderId}/assign-rider`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ riderId }),
      });
      fetchData();
    } catch (error) {
      console.error("Error assigning rider:", error);
    }
  };

  const handleToggleRider = async (riderId: number) => {
    await fetch(apiUrl(`/api/admin/riders/${riderId}/toggle`), { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const handleUpdateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRider) return;
    await fetch(apiUrl(`/api/admin/riders/${editingRider.id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(editRiderForm),
    });
    setEditingRider(null);
    fetchData();
  };

  const handleToggleHotel = async (hotelId: number) => {
    await fetch(apiUrl(`/api/admin/hotels/${hotelId}/toggle`), { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    fetchData();
  };

  const handleUpdateHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHotel) return;
    await fetch(apiUrl(`/api/admin/hotels/${editingHotel.id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...editHotelForm, rating: parseFloat(editHotelForm.rating) }),
    });
    setEditingHotel(null);
    fetchData();
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">System management and analytics</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-border overflow-x-auto">
          {(["analytics", "orders", "riders", "hotels"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold capitalize border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Analytics Tab */}
        {activeTab === "analytics" && analytics && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-base">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold">{analytics.totalUsers}</p>
                  </div>
                  <Users size={32} className="text-primary opacity-50" />
                </div>
              </div>
              <div className="card-base">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Riders</p>
                    <p className="text-3xl font-bold">{analytics.totalRiders}</p>
                  </div>
                  <Bike size={32} className="text-orange-500 opacity-50" />
                </div>
              </div>
              <div className="card-base">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hotels</p>
                    <p className="text-3xl font-bold">{analytics.totalHotels}</p>
                  </div>
                  <ShoppingBag size={32} className="text-blue-500 opacity-50" />
                </div>
              </div>
              <div className="card-base">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Online Riders</p>
                    <p className="text-3xl font-bold text-accent">{analytics.onlineRiders}</p>
                  </div>
                  <Bike size={32} className="text-accent opacity-50" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card-base">
                <p className="text-sm text-muted-foreground mb-2">Total Orders</p>
                <p className="text-4xl font-bold">{analytics.totalOrders}</p>
              </div>
              <div className="card-base">
                <p className="text-sm text-muted-foreground mb-2">Delivered Orders</p>
                <p className="text-4xl font-bold text-accent">{analytics.deliveredOrders}</p>
              </div>
              <div className="card-base">
                <p className="text-sm text-muted-foreground mb-2">Delivery Revenue (Admin)</p>
                <p className="text-4xl font-bold text-primary">₹{analytics.totalRevenue}</p>
              </div>
            </div>

            {/* Admin UPI Settings */}
            <div className="card-base">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <IndianRupee size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Admin UPI ID (Delivery Fee Collection)</h3>
                  <p className="text-sm text-muted-foreground">Customers will pay the delivery fee to this UPI ID</p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="admin@upi"
                  value={adminUpiId}
                  onChange={(e) => setAdminUpiId(e.target.value)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleSaveAdminUpi}
                  disabled={adminUpiSaving || !adminUpiId.trim()}
                  className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50"
                >
                  {adminUpiSaved ? <><Check size={16} /> Saved</> : adminUpiSaving ? "Saving..." : "Save UPI"}
                </button>
              </div>
              {adminUpiSaved && <p className="text-sm text-green-600 mt-2">Admin UPI ID saved!</p>}
            </div>

            <div className="card-base">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bike size={20} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delivery Fee Settings</h3>
                  <p className="text-sm text-muted-foreground">Customers and orders use only these admin-managed rules</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={deliverySettings.deliveryFeeAmount}
                  onChange={(e) => setDeliverySettings((current) => ({ ...current, deliveryFeeAmount: Number(e.target.value) }))}
                  placeholder="Base delivery fee"
                  className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={deliverySettings.freeDeliveryThreshold}
                  onChange={(e) => setDeliverySettings((current) => ({ ...current, freeDeliveryThreshold: Number(e.target.value) }))}
                  placeholder="Free delivery threshold"
                  className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <label className="flex items-center gap-3 px-4 py-2 border border-border rounded-lg text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={deliverySettings.firstOrderFree}
                    onChange={(e) => setDeliverySettings((current) => ({ ...current, firstOrderFree: e.target.checked }))}
                  />
                  First order free
                </label>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSaveDeliverySettings}
                  disabled={deliverySaving}
                  className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50"
                >
                  {deliverySaved ? <><Check size={16} /> Saved</> : deliverySaving ? "Saving..." : "Save Delivery Rules"}
                </button>
                {deliverySaved && <p className="text-sm text-green-600">Delivery settings saved!</p>}
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="card-base">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">All Orders ({orders.length})</h2>
              <button onClick={fetchData} className="btn-secondary text-sm py-2 px-4">
                Refresh
              </button>
            </div>
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="p-4 border border-border rounded-lg">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="font-semibold text-sm">{order.user?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Restaurant</p>
                      <p className="font-semibold text-sm">{order.hotel?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-semibold text-primary">₹{order.totalPrice}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        order.status === "Delivered" ? "bg-accent text-accent-foreground" :
                        order.status === "Cancelled" ? "bg-destructive text-destructive-foreground" :
                        "bg-orange-100 text-orange-700"
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  {order.status === "Ready" && availableRiders.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">Assign rider:</span>
                      <select
                        onChange={(e) => e.target.value && handleAssignRider(order.id, e.target.value)}
                        className="text-sm px-3 py-1 border border-border rounded-lg focus:outline-none"
                        defaultValue=""
                      >
                        <option value="" disabled>Choose rider</option>
                        {availableRiders.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Riders Tab */}
        {activeTab === "riders" && (
          <div className="space-y-8">
            <div className="card-base">
              <h2 className="text-2xl font-bold mb-6">Create New Rider</h2>
              <form onSubmit={handleCreateRider} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={riderForm.name}
                    onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                    placeholder="Name"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="email"
                    value={riderForm.email}
                    onChange={(e) => setRiderForm({ ...riderForm, email: e.target.value })}
                    placeholder="Email"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="tel"
                    value={riderForm.phone}
                    onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                    placeholder="Phone"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="password"
                    value={riderForm.password}
                    onChange={(e) => setRiderForm({ ...riderForm, password: e.target.value })}
                    placeholder="Password"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Create Rider
                </button>
              </form>
            </div>

            <div className="card-base">
              <h2 className="text-2xl font-bold mb-4">All Riders ({riders.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-2 font-semibold">Name</th>
                      <th className="text-left py-2 font-semibold">Email</th>
                      <th className="text-left py-2 font-semibold">Phone</th>
                      <th className="text-left py-2 font-semibold">Status</th>
                      <th className="text-left py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map((rider) => (
                      <tr key={rider.id} className="border-b border-border hover:bg-secondary">
                        <td className="py-3">{rider.name}</td>
                        <td className="py-3">{rider.email}</td>
                        <td className="py-3">{rider.phone}</td>
                        <td className="py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            rider.isOnline
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {rider.isOnline ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleRider(rider.id)}
                              title={rider.isAvailable ? "Pause Rider" : "Unpause Rider"}
                              className={`p-1 rounded ${rider.isAvailable ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}
                            >
                              {rider.isAvailable ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                            </button>
                            <button
                              onClick={() => { setEditingRider(rider); setEditRiderForm({ name: rider.name, phone: rider.phone, password: "" }); }}
                              className="p-1 text-primary hover:bg-primary/10 rounded"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteRider(rider.id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Hotels Tab */}
        {activeTab === "hotels" && (
          <div className="space-y-8">
            <div className="card-base">
              <h2 className="text-2xl font-bold mb-6">Create New Hotel</h2>
              <form onSubmit={handleCreateHotel} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={hotelForm.name}
                    onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                    placeholder="Hotel Name"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="email"
                    value={hotelForm.email}
                    onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })}
                    placeholder="Email"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="tel"
                    value={hotelForm.phone}
                    onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })}
                    placeholder="Phone"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="password"
                    value={hotelForm.password}
                    onChange={(e) => setHotelForm({ ...hotelForm, password: e.target.value })}
                    placeholder="Password"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    type="text"
                    value={hotelForm.location}
                    onChange={(e) => setHotelForm({ ...hotelForm, location: e.target.value })}
                    placeholder="Location"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <select
                    value={hotelForm.category}
                    onChange={(e) => setHotelForm({ ...hotelForm, category: e.target.value })}
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Fast Food">Fast Food</option>
                    <option value="Pizza">Pizza</option>
                    <option value="Biryani">Biryani</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    step="0.1"
                    value={hotelForm.rating}
                    onChange={(e) => setHotelForm({ ...hotelForm, rating: e.target.value })}
                    placeholder="Rating"
                    required
                    className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Create Hotel
                </button>
              </form>
            </div>

            <div className="card-base">
              <h2 className="text-2xl font-bold mb-4">All Hotels ({hotels.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left py-2 font-semibold">Name</th>
                      <th className="text-left py-2 font-semibold">Email</th>
                      <th className="text-left py-2 font-semibold">Location</th>
                      <th className="text-left py-2 font-semibold">Category</th>
                      <th className="text-left py-2 font-semibold">Rating</th>
                      <th className="text-left py-2 font-semibold">Status</th>
                      <th className="text-left py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotels.map((hotel) => (
                      <tr key={hotel.id} className="border-b border-border hover:bg-secondary">
                        <td className="py-3">{hotel.name}</td>
                        <td className="py-3">{hotel.email}</td>
                        <td className="py-3">{hotel.location}</td>
                        <td className="py-3">{hotel.category}</td>
                        <td className="py-3 font-semibold">{hotel.rating.toFixed(1)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${hotel.isOpen ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            {hotel.isOpen ? "Open" : "Closed"}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleHotel(hotel.id)}
                              title={hotel.isOpen ? "Close Restaurant" : "Open Restaurant"}
                              className={`p-1 rounded ${hotel.isOpen ? "text-amber-600 hover:bg-amber-50" : "text-green-600 hover:bg-green-50"}`}
                            >
                              {hotel.isOpen ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                            </button>
                            <button
                              onClick={() => { setEditingHotel(hotel); setEditHotelForm({ name: hotel.name, phone: hotel.phone, location: hotel.location, category: hotel.category, password: "", rating: String(hotel.rating) }); }}
                              className="p-1 text-primary hover:bg-primary/10 rounded"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteHotel(hotel.id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Rider Modal */}
      {editingRider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1">Edit Rider</h3>
            <p className="text-sm text-muted-foreground mb-4">{editingRider.name}</p>
            <form onSubmit={handleUpdateRider} className="space-y-3">
              <input type="text" placeholder="Name" value={editRiderForm.name}
                onChange={(e) => setEditRiderForm({ ...editRiderForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="tel" placeholder="Phone" value={editRiderForm.phone}
                onChange={(e) => setEditRiderForm({ ...editRiderForm, phone: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="password" placeholder="New Password (leave blank to keep current)" value={editRiderForm.password}
                onChange={(e) => setEditRiderForm({ ...editRiderForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-2">Save Changes</button>
                <button type="button" onClick={() => setEditingRider(null)} className="btn-secondary flex-1 py-2">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Hotel Modal */}
      {editingHotel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1">Edit Restaurant</h3>
            <p className="text-sm text-muted-foreground mb-4">{editingHotel.name}</p>
            <form onSubmit={handleUpdateHotel} className="space-y-3">
              <input type="text" placeholder="Name" value={editHotelForm.name}
                onChange={(e) => setEditHotelForm({ ...editHotelForm, name: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="tel" placeholder="Phone" value={editHotelForm.phone}
                onChange={(e) => setEditHotelForm({ ...editHotelForm, phone: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="text" placeholder="Location" value={editHotelForm.location}
                onChange={(e) => setEditHotelForm({ ...editHotelForm, location: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <select value={editHotelForm.category}
                onChange={(e) => setEditHotelForm({ ...editHotelForm, category: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="Fast Food">Fast Food</option>
                <option value="Pizza">Pizza</option>
                <option value="Biryani">Biryani</option>
                <option value="Chinese">Chinese</option>
                <option value="South Indian">South Indian</option>
                <option value="Desserts">Desserts</option>
              </select>
              <input type="number" min="1" max="5" step="0.1" placeholder="Rating" value={editHotelForm.rating}
                onChange={(e) => setEditHotelForm({ ...editHotelForm, rating: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="password" placeholder="New Password (leave blank to keep current)" value={editHotelForm.password}
                onChange={(e) => setEditHotelForm({ ...editHotelForm, password: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 py-2">Save Changes</button>
                <button type="button" onClick={() => setEditingHotel(null)} className="btn-secondary flex-1 py-2">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
