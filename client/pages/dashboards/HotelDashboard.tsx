import { useEffect, useState, useRef } from "react";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { apiUrl } from "@/lib/api";
import { ShoppingBag, UtensilsCrossed, TrendingUp, Bell, IndianRupee, Check, ImagePlus, Pencil, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from "lucide-react";
import { initializeSocket, disconnectSocket } from "@/services/socket";

interface Order {
  id: number;
  user: { name: string; phone: string };
  status: string;
  totalPrice: number;
  itemsPrice: number;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
}

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  isAvailable: boolean;
}

export default function HotelDashboard() {
  const { token } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", price: "", description: "", category: "Main Course", image: "", isAvailable: true });
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [menuForm, setMenuForm] = useState({
    name: "",
    price: "",
    description: "",
    category: "Main Course",
    image: "",
  });
  const [imagePreview, setImagePreview] = useState("");
  const socketRef = useRef(false);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [upiId, setUpiId] = useState("");
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiSaved, setUpiSaved] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchUpiId();
    fetchMenuItems();

    // Set up socket for real-time order notifications
    if (token && !socketRef.current) {
      socketRef.current = true;
      const socket = initializeSocket(token);
      socket.on("newOrder", () => {
        setNewOrderAlert(true);
        fetchOrders();
        startBeeping();
      });
    }

    return () => {
      disconnectSocket();
      socketRef.current = false;
      stopBeeping();
    };
  }, [token]);

  const fetchOrders = async () => {
    try {
      const response = await fetch(apiUrl("/api/hotel/orders"), {
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

  const fetchUpiId = async () => {
    try {
      const res = await fetch(apiUrl("/api/hotel/profile"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.upiId) setUpiId(data.upiId);
      }
    } catch (e) {
      console.error("Error fetching UPI:", e);
    }
  };

  const handleSaveUpi = async () => {
    setUpiSaving(true);
    try {
      const res = await fetch(apiUrl("/api/hotel/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ upiId }),
      });
      if (res.ok) {
        setUpiSaved(true);
        setTimeout(() => setUpiSaved(false), 3000);
      }
    } catch (e) {
      console.error("Error saving UPI:", e);
    } finally {
      setUpiSaving(false);
    }
  };

  const fetchMenuItems = async () => {
    setMenuLoading(true);
    try {
      // Get hotel id from profile first
      const profileRes = await fetch(apiUrl("/api/hotel/profile"), { headers: { Authorization: `Bearer ${token}` } });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        const menuRes = await fetch(apiUrl(`/api/hotels/${profile.id}/menu`));
        if (menuRes.ok) {
          const authMenuRes = await fetch(apiUrl("/api/hotel/menu/all"), { headers: { Authorization: `Bearer ${token}` } });
          if (authMenuRes.ok) {
            setMenuItems(await authMenuRes.json());
          } else {
            setMenuItems(await menuRes.json());
          }
        }
      }
    } catch (e) {
      console.error("Error fetching menu items:", e);
    } finally {
      setMenuLoading(false);
    }
  };

  const handleDeleteMenuItem = async (itemId: number) => {
    if (!confirm("Delete this menu item?")) return;
    try {
      const res = await fetch(apiUrl(`/api/hotel/menu/${itemId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) fetchMenuItems();
    } catch (e) {
      console.error("Error deleting menu item:", e);
    }
  };

  // ── Beep sound helpers (Web Audio API – no external file needed) ──
  const playBeep = () => {
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
      // AudioContext may be blocked until user interaction — silently ignore
    }
  };

  const startBeeping = () => {
    if (beepIntervalRef.current) return;
    playBeep();
    beepIntervalRef.current = setInterval(playBeep, 1800);
  };

  const stopBeeping = () => {
    if (beepIntervalRef.current) {
      clearInterval(beepIntervalRef.current);
      beepIntervalRef.current = null;
    }
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setEditForm({ name: item.name, price: String(item.price), description: item.description, category: item.category, image: item.image, isAvailable: item.isAvailable });
  };

  const handleUpdateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      const res = await fetch(apiUrl(`/api/hotel/menu/${editingItem.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editForm, price: parseFloat(editForm.price) }),
      });
      if (res.ok) {
        setEditingItem(null);
        fetchMenuItems();
      }
    } catch (e) {
      console.error("Error updating menu item:", e);
    }
  };

  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/hotel/menu"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(menuForm),
      });

      if (response.ok) {
        setMenuForm({ name: "", price: "", description: "", category: "Main Course", image: "" });
        setImagePreview("");
        setShowAddMenu(false);
        fetchMenuItems();
      }
    } catch (error) {
      console.error("Error adding menu item:", error);
    }
  };

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    // Stop beeping as soon as the owner takes any action on an order
    stopBeeping();
    setNewOrderAlert(false);
    try {
      const response = await fetch(apiUrl(`/api/hotel/orders/${orderId}/status`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        fetchOrders();
      }
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Restaurant Dashboard</h1>
            <p className="text-muted-foreground">Manage your restaurant and orders</p>
          </div>
          {newOrderAlert && (
            <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg border border-primary/20">
              <Bell size={18} className="animate-bounce" />
              <span className="font-semibold text-sm">New order received!</span>
              <button onClick={() => { setNewOrderAlert(false); stopBeeping(); }} className="text-xs underline ml-2">Dismiss</button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card-base">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-3xl font-bold">{orders.filter((o) => o.status !== "Cancelled").length}</p>
              </div>
              <ShoppingBag size={32} className="text-primary opacity-50" />
            </div>
          </div>
          <div className="card-base">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Orders</p>
                <p className="text-3xl font-bold">
                  {orders.filter((o) => o.status === "Placed").length}
                </p>
              </div>
              <UtensilsCrossed size={32} className="text-orange-500 opacity-50" />
            </div>
          </div>
          <div className="card-base">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold text-primary">
                  ₹{orders.filter((o) => o.status !== "Cancelled").reduce((sum, o) => sum + (o.itemsPrice || o.totalPrice), 0)}
                </p>
              </div>
              <TrendingUp size={32} className="text-accent opacity-50" />
            </div>
          </div>
        </div>

        {/* UPI Settings */}
        <div className="card-base mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <IndianRupee size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">UPI Payment Settings</h3>
              <p className="text-sm text-muted-foreground">Set your UPI ID so customers can pay you directly</p>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="yourname@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSaveUpi}
              disabled={upiSaving || !upiId.trim()}
              className="btn-primary px-6 py-2 flex items-center gap-2 disabled:opacity-50"
            >
              {upiSaved ? (
                <>
                  <Check size={16} /> Saved
                </>
              ) : upiSaving ? (
                "Saving..."
              ) : (
                "Save UPI"
              )}
            </button>
          </div>
          {upiSaved && (
            <p className="text-sm text-green-600 mt-2">UPI ID saved successfully! Customers can now pay via UPI.</p>
          )}
        </div>

        {/* Action buttons row */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => { setShowAddMenu(!showAddMenu); setShowManageMenu(false); }}
            className="btn-primary"
          >
            {showAddMenu ? "Cancel" : "+ Add Menu Item"}
          </button>
          <button
            onClick={() => { setShowManageMenu(!showManageMenu); setShowAddMenu(false); }}
            className="btn-secondary flex items-center gap-2"
          >
            <UtensilsCrossed size={16} />
            {showManageMenu ? "Hide Menu" : "Manage Menu"}
            {showManageMenu ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Manage Menu Section */}
        {showManageMenu && (
          <div className="card-base mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Your Menu ({menuItems.length} items)</h3>
              <button onClick={fetchMenuItems} className="text-sm text-primary hover:underline">Refresh</button>
            </div>

            {menuLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
              </div>
            ) : menuItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No menu items yet. Add some above.</p>
            ) : (
              <div className="space-y-3">
                {menuItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-3 border border-border rounded-xl">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-16 h-16 bg-secondary rounded-lg shrink-0 flex items-center justify-center">
                        <UtensilsCrossed size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold truncate">{item.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.isAvailable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {item.isAvailable ? "Available" : "Hidden"}
                        </span>
                      </div>
                      <p className="text-primary font-semibold text-sm">₹{item.price}</p>
                      <p className="text-muted-foreground text-xs truncate">{item.category}{item.description ? ` · ${item.description}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg border border-border hover:bg-primary hover:text-white hover:border-primary transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteMenuItem(item.id)}
                        className="p-2 rounded-lg border border-border hover:bg-destructive hover:text-white hover:border-destructive transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Menu Item Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">Edit Menu Item</h3>
                <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-secondary rounded-lg">✕</button>
              </div>
              <form onSubmit={handleUpdateMenuItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Item Name</label>
                  <input type="text" required value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Price (₹)</label>
                    <input type="number" required value={editForm.price}
                      onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary">
                      <option>Main Course</option>
                      <option>Appetizers</option>
                      <option>Desserts</option>
                      <option>Beverages</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea rows={2} value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium mb-1">
                    <ImagePlus size={15} className="text-primary" /> Image URL
                  </label>
                  <input type="url" placeholder="https://..." value={editForm.image}
                    onChange={(e) => setEditForm({ ...editForm, image: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary" />
                  {editForm.image && (
                    <img src={editForm.image} alt="preview" className="mt-2 w-24 h-20 object-cover rounded-lg"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditForm({ ...editForm, isAvailable: !editForm.isAvailable })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                      editForm.isAvailable ? "border-green-500 bg-green-50 text-green-700" : "border-red-400 bg-red-50 text-red-600"
                    }`}>
                    {editForm.isAvailable ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {editForm.isAvailable ? "Available" : "Hidden from menu"}
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Menu Item Form */}
        {showAddMenu && (
          <div className="card-base mb-8">
            <h3 className="text-lg font-bold mb-4">Add New Menu Item</h3>
            <form onSubmit={handleAddMenuItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Item Name</label>
                <input
                  type="text"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price (₹)</label>
                  <input
                    type="number"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={menuForm.category}
                    onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="Main Course">Main Course</option>
                    <option value="Appetizers">Appetizers</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Food Image */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium mb-2">
                  <ImagePlus size={16} className="text-primary" /> Food Image URL
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/food-image.jpg"
                  value={menuForm.image}
                  onChange={(e) => {
                    setMenuForm({ ...menuForm, image: e.target.value });
                    setImagePreview(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {imagePreview && (
                  <div className="mt-3 relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      onError={() => setImagePreview("")}
                      className="w-32 h-24 object-cover rounded-xl border border-border"
                    />
                    <button
                      type="button"
                      onClick={() => { setImagePreview(""); setMenuForm({ ...menuForm, image: "" }); }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <button type="submit" className="btn-primary w-full">
                Add Item
              </button>
            </form>
          </div>
        )}

        {/* Orders */}
        <div className="card-base">
          <h2 className="text-2xl font-bold mb-6">Current Orders</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
                <div key={order.id} className="p-4 border border-border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Customer</p>
                      <p className="font-semibold">{order.user.name}</p>
                      <p className="text-sm text-muted-foreground">{order.user.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Order Amount</p>
                      <p className="text-2xl font-bold text-primary">₹{order.totalPrice}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">Items:</p>
                    <div className="text-sm space-y-1">
                      {order.items.map((item, idx) => (
                        <p key={idx}>{item.name} x{item.quantity}</p>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center justify-between">
                    <p className="text-sm font-semibold">
                      Status: <span className="text-accent">{order.status}</span>
                    </p>
                    {order.status === "Placed" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateOrderStatus(order.id, "Accepted")}
                          className="btn-primary py-2 px-4 text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, "Cancelled")}
                          className="btn-secondary py-2 px-4 text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {order.status === "Accepted" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "Preparing")}
                        className="btn-primary py-2 px-4 text-sm"
                      >
                        Start Preparing
                      </button>
                    )}
                    {order.status === "Preparing" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "Ready")}
                        className="btn-primary py-2 px-4 text-sm"
                      >
                        Mark Ready
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
