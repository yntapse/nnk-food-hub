import { useEffect, useState } from "react";
import Header from "@/components/Header";
import GoogleMapEmbed from "@/components/GoogleMapEmbed";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import { ShoppingBag, MapPin, Pencil, Check, X, Navigation, Home, Building2, Briefcase, Loader2, KeyRound } from "lucide-react";

interface Order {
  id: number;
  hotel: { name: string };
  totalPrice: number;
  status: string;
  createdAt: string;
  deliveryOtp?: string;
}

type AddressLabel = "Home" | "Work" | "Other";

interface AddressFormState {
  locationText: string;
  houseNumber: string;
  landmark: string;
  addressLabel: AddressLabel;
}

export default function UserDashboard() {
  const { user, token, updateAddress } = useAuthStore();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressFormState>({
    locationText: "",
    houseNumber: "",
    landmark: "",
    addressLabel: "Home",
  });
  const [addressSaving, setAddressSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [previewQuery, setPreviewQuery] = useState("");

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

  const updateAddressField = <K extends keyof AddressFormState>(key: K, value: AddressFormState[K]) => {
    setAddressForm((current) => ({ ...current, [key]: value }));
  };

  const buildAddressString = (form: AddressFormState) => {
    const detailParts = [
      form.houseNumber.trim() ? `House/Flat: ${form.houseNumber.trim()}` : "",
      form.landmark.trim() ? `Landmark: ${form.landmark.trim()}` : "",
    ].filter(Boolean);

    const lines = [
      `${form.addressLabel}`,
      detailParts.join(", "),
      form.locationText.trim(),
    ].filter(Boolean);

    return lines.join(" | ");
  };

  const parseExistingAddress = (address?: string | null): AddressFormState => {
    if (!address) {
      return {
        locationText: "",
        houseNumber: "",
        landmark: "",
        addressLabel: "Home",
      };
    }

    const parts = address.split("|").map((part) => part.trim()).filter(Boolean);
    const label = (parts[0] === "Home" || parts[0] === "Work" || parts[0] === "Other") ? parts[0] as AddressLabel : "Home";
    const detailLine = parts.find((part) => part.startsWith("House/Flat:") || part.startsWith("Landmark:")) || "";
    const locationText = parts[parts.length - 1] ?? address;

    const houseMatch = detailLine.match(/House\/Flat:\s*([^,|]+)/i);
    const landmarkMatch = detailLine.match(/Landmark:\s*([^,|]+)/i);

    return {
      addressLabel: label,
      houseNumber: houseMatch?.[1]?.trim() ?? "",
      landmark: landmarkMatch?.[1]?.trim() ?? "",
      locationText: parts.length > 1 ? locationText : address,
    };
  };

  const handleStartEdit = () => {
    const parsed = parseExistingAddress(user?.address);
    setAddressForm(parsed);
    setPreviewQuery(parsed.locationText || user?.address || "");
    setLocationError("");
    setEditingAddress(true);
  };

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported on this device.");
      return;
    }

    setDetectingLocation(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          );

          if (!response.ok) {
            throw new Error("Unable to fetch the current address.");
          }

          const data = await response.json();
          const resolvedAddress = data.display_name || `${latitude}, ${longitude}`;

          setAddressForm((current) => ({
            ...current,
            locationText: resolvedAddress,
          }));
          setPreviewQuery(`${latitude},${longitude}`);
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
          setLocationError("Current location found, but address lookup failed. You can still enter details manually.");
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError("Unable to access your current location. Please allow location permission and try again.");
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleSaveAddress = async () => {
    const finalAddress = buildAddressString(addressForm);
    if (!addressForm.locationText.trim()) return;

    setAddressSaving(true);
    try {
      const res = await fetch(apiUrl("/api/user/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: finalAddress }),
      });
      if (res.ok) {
        updateAddress(finalAddress);
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
                  onClick={handleStartEdit}
                  className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline"
                >
                  <Pencil size={14} /> {user?.address ? "Change" : "Add Address"}
                </button>
              )}
            </div>

            {editingAddress ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-secondary/40 p-4 space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Set your delivery location</p>
                      <p className="text-xs text-muted-foreground">Pick your current location, then add flat number and landmark like Swiggy.</p>
                    </div>
                    <button
                      onClick={handleUseCurrentLocation}
                      disabled={detectingLocation}
                      className="btn-primary text-sm px-4 py-2.5 disabled:opacity-50"
                    >
                      {detectingLocation ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
                      {detectingLocation ? "Detecting..." : "Use Current Location"}
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Area / Full Location</label>
                    <textarea
                      rows={3}
                      value={addressForm.locationText}
                      onChange={(e) => {
                        updateAddressField("locationText", e.target.value);
                        setPreviewQuery(e.target.value);
                      }}
                      placeholder="Search or use current location to fill area, street and city"
                      className="mt-1 w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm bg-background"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">House / Flat / Door No.</label>
                      <input
                        type="text"
                        value={addressForm.houseNumber}
                        onChange={(e) => updateAddressField("houseNumber", e.target.value)}
                        placeholder="Flat 202, Sai Residency"
                        className="mt-1 input-base"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Nearby Landmark</label>
                      <input
                        type="text"
                        value={addressForm.landmark}
                        onChange={(e) => updateAddressField("landmark", e.target.value)}
                        placeholder="Near bus stand, beside temple"
                        className="mt-1 input-base"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Save as</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {([
                        { label: "Home", icon: Home },
                        { label: "Work", icon: Briefcase },
                        { label: "Other", icon: Building2 },
                      ] as const).map(({ label, icon: Icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => updateAddressField("addressLabel", label)}
                          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
                            addressForm.addressLabel === label
                              ? "bg-primary text-white border-primary"
                              : "bg-background text-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          <Icon size={14} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {locationError && (
                    <p className="text-xs text-destructive font-medium">{locationError}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveAddress}
                    disabled={addressSaving || !addressForm.locationText.trim()}
                    className="btn-primary flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-50"
                  >
                    <Check size={15} /> {addressSaving ? "Saving..." : "Save Address"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingAddress(false);
                      setLocationError("");
                    }}
                    className="btn-secondary flex items-center gap-2 px-5 py-2 text-sm"
                  >
                    <X size={15} /> Cancel
                  </button>
                </div>

                {previewQuery.trim() && (
                  <GoogleMapEmbed
                    query={previewQuery}
                    title="Preview on Google Maps"
                    heightClassName="h-56"
                  />
                )}
              </div>
            ) : user?.address ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground bg-secondary rounded-xl px-4 py-3">{user.address}</p>
                <GoogleMapEmbed
                  query={user.address}
                  title="Saved delivery location"
                  heightClassName="h-56"
                />
              </div>
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
                    className="block p-4 border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer"
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
                    {/* Show OTP when rider is coming */}
                    {order.deliveryOtp && order.status === "Out for Delivery" && (
                      <div className="mt-3 flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2" onClick={(e) => e.preventDefault()}>
                        <KeyRound size={14} className="text-primary shrink-0" />
                        <span className="text-xs text-primary font-semibold">Delivery OTP:</span>
                        <span className="font-black tracking-widest text-primary text-sm">{order.deliveryOtp}</span>
                        <span className="text-xs text-muted-foreground ml-1">(Share with rider)</span>
                      </div>
                    )}
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
