import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { useCartStore } from "@/stores/cartStore";
import { MapPin, Star, Plus, Minus, ShoppingCart as CartIcon, Clock, ArrowLeft, Leaf, Drumstick } from "lucide-react";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
}

interface Hotel {
  id: number;
  name: string;
  location: string;
  rating: number;
  category: string;
  isOpen: boolean;
}

const MENU_IMAGES = [
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&q=80",
  "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=300&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=300&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&q=80",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=300&q=80",
];

function SkeletonMenu() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card-base flex gap-4 animate-pulse">
          <div className="flex-1 space-y-3">
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-5 w-16" />
          </div>
          <div className="skeleton w-28 h-28 rounded-xl shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default function Restaurant() {
  const { hotelId } = useParams();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const { addItem, getItemCount } = useCartStore();

  const categories = ["All", "Main Course", "Appetizers", "Desserts", "Beverages"];

  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      try {
        setLoading(true);
        const [hRes, mRes] = await Promise.all([
          fetch(apiUrl(`/api/hotels/${hotelId}`)),
          fetch(apiUrl(`/api/hotels/${hotelId}/menu`)),
        ]);
        if (hRes.ok && mRes.ok) {
          setHotel(await hRes.json());
          setMenuItems(await mRes.json());
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [hotelId]);

  const handleAddToCart = (item: MenuItem) => {
    const qty = quantities[item.id] || 1;
    addItem(
      { id: String(item.id), name: item.name, price: item.price, quantity: qty },
      hotelId!,
      hotel?.name || ""
    );
    setQuantities((q) => ({ ...q, [item.id]: 0 }));
  };

  const setQty = (id: number, val: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, val) }));

  const filteredItems =
    selectedCategory === "All"
      ? menuItems
      : menuItems.filter((i) => i.category === selectedCategory);

  const isVeg = (cat: string) => ["Appetizers", "Beverages", "Desserts"].includes(cat);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <SkeletonMenu />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <Header />

      {hotel && (
        <>
          {/* Restaurant Banner */}
          <div className="relative h-48 md:h-64 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"
              alt={hotel.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 max-w-5xl mx-auto">
              <Link to="/" className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-3 transition-colors">
                <ArrowLeft size={16} /> Back to restaurants
              </Link>
              <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-2">{hotel.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full">
                  <Star size={14} className="text-yellow-400 fill-yellow-400" />
                  {hotel.rating.toFixed(1)}
                </span>
                <span className="flex items-center gap-1 text-white/90">
                  <MapPin size={14} /> {hotel.location}
                </span>
                <span className="flex items-center gap-1 text-white/90">
                  <Clock size={14} /> 20-30 min
                </span>
                <span className="badge-primary text-xs">{hotel.category}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Category sidebar / horizontal scroll on mobile */}
              <div className="lg:w-48 shrink-0">
                <div className="lg:sticky lg:top-20">
                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3 hidden lg:block">
                    Categories
                  </h3>
                  <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                          ${selectedCategory === cat
                            ? "bg-primary text-white shadow-md shadow-primary/20"
                            : "bg-white border border-border hover:bg-secondary text-foreground"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="flex-1 space-y-4">
                <h2 className="text-lg font-bold">
                  {selectedCategory === "All" ? "Full Menu" : selectedCategory}
                  <span className="text-muted-foreground font-normal text-sm ml-2">
                    ({filteredItems.length} items)
                  </span>
                </h2>

                {filteredItems.length > 0 ? (
                  filteredItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="card-base flex gap-4 group animate-fade-in"
                      style={{ animationDelay: `${idx * 30}ms`, animationFillMode: "backwards" }}
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isVeg(item.category) ? (
                            <span className="w-4 h-4 border-2 border-green-600 rounded-sm flex items-center justify-center">
                              <span className="w-2 h-2 bg-green-600 rounded-full" />
                            </span>
                          ) : (
                            <span className="w-4 h-4 border-2 border-red-600 rounded-sm flex items-center justify-center">
                              <span className="w-2 h-2 bg-red-600 rounded-full" />
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-base">{item.name}</h3>
                        <p className="text-primary font-bold text-lg mt-1">₹{item.price}</p>
                        <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      {/* Image + Add button */}
                      <div className="relative shrink-0 w-28 md:w-32">
                        <img
                          src={item.image || MENU_IMAGES[idx % MENU_IMAGES.length]}
                          alt={item.name}
                          className="w-full h-24 md:h-28 object-cover rounded-xl"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).src = MENU_IMAGES[idx % MENU_IMAGES.length]; }}
                        />
                        {/* Add / quantity controls */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                          {(quantities[item.id] || 0) > 0 ? (
                            <div className="flex items-center bg-primary text-white rounded-xl shadow-lg overflow-hidden animate-scale-in">
                              <button
                                onClick={() => setQty(item.id, (quantities[item.id] || 0) - 1)}
                                className="px-3 py-1.5 hover:bg-orange-600 transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="px-2 font-bold text-sm min-w-[24px] text-center">
                                {quantities[item.id]}
                              </span>
                              <button
                                onClick={() => setQty(item.id, (quantities[item.id] || 0) + 1)}
                                className="px-3 py-1.5 hover:bg-orange-600 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setQty(item.id, 1)}
                              className="bg-white border-2 border-primary text-primary font-bold text-sm
                                px-6 py-1.5 rounded-xl shadow-lg hover:bg-primary hover:text-white
                                transition-all duration-200 active:scale-95"
                            >
                              ADD
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No items in this category</p>
                  </div>
                )}

                {/* Add to cart confirmation for selected items */}
                {Object.values(quantities).some((q) => q > 0) && (
                  <div className="sticky bottom-20 lg:bottom-4 z-20">
                    <button
                      onClick={() => {
                        filteredItems.forEach((item) => {
                          if ((quantities[item.id] || 0) > 0) handleAddToCart(item);
                        });
                      }}
                      className="w-full btn-primary py-4 text-base shadow-2xl rounded-2xl animate-slide-up"
                    >
                      <CartIcon size={20} />
                      Add {Object.values(quantities).reduce((s, q) => s + q, 0)} item(s) to cart
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky mobile cart bar */}
          {getItemCount() > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-border lg:hidden animate-slide-up">
              <Link
                to="/cart"
                className="btn-primary w-full py-4 text-base rounded-2xl shadow-xl"
              >
                <CartIcon size={20} />
                View Cart ({getItemCount()} items)
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
