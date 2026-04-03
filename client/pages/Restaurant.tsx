import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { useCartStore } from "@/stores/cartStore";
import { MapPin, Star, Plus, Minus, ShoppingCart as CartIcon, Clock, ArrowLeft, Leaf, IndianRupee, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  isAvailable: boolean;
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
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
          <div className="flex-1 space-y-3">
            <div className="skeleton-shimmer h-4 w-2/3 rounded-lg" />
            <div className="skeleton-shimmer h-3 w-full rounded-lg" />
            <div className="skeleton-shimmer h-5 w-16 rounded-lg" />
          </div>
          <div className="skeleton-shimmer w-28 h-28 rounded-2xl shrink-0" />
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
  const tabsRef = useRef<HTMLDivElement>(null);

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
    if (!hotel?.isOpen || !item.isAvailable) return;
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

  const totalQty = Object.values(quantities).reduce((s, q) => s + q, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <Header />
        <div className="max-w-5xl mx-auto px-4 py-8">
          <SkeletonMenu />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-nav md:pb-8">
      <Header />

      {hotel && (
        <>
          {/* ===== RESTAURANT BANNER ===== */}
          <div className={`relative h-52 md:h-72 overflow-hidden bg-gray-900 ${hotel.isOpen ? "" : "grayscale"}`}>
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"
              alt={hotel.name}
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Back button */}
            <Link
              to="/"
              className="absolute top-4 left-4 flex items-center gap-1.5 text-white bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-black/50 transition-colors"
            >
              <ArrowLeft size={15} /> Back
            </Link>

            {/* Hotel info overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 md:px-8 max-w-5xl mx-auto">
              <h1 className="text-2xl md:text-4xl font-extrabold text-white mb-2 drop-shadow-lg">
                {hotel.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full font-semibold">
                  <Star size={13} className="text-yellow-400 fill-yellow-400" />
                  {hotel.rating.toFixed(1)}
                </span>
                <span className="flex items-center gap-1 text-white/90">
                  <MapPin size={13} /> {hotel.location}
                </span>
                <span className="flex items-center gap-1 text-white/90">
                  <Clock size={13} /> 20–30 min
                </span>
                <span className="flex items-center gap-1 text-white/90">
                  <IndianRupee size={13} /> 200 for two
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${hotel.isOpen ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                  {hotel.isOpen ? "Open" : "Closed"}
                </span>
              </div>
            </div>
          </div>

          {!hotel.isOpen && (
            <div className="max-w-5xl mx-auto px-4 pt-4">
              <div className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-gray-100 px-4 py-3 text-gray-700">
                <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <p className="font-extrabold text-sm">This restaurant is offline right now</p>
                  <p className="text-xs text-gray-500">You can browse the menu, but ordering is locked until the restaurant comes online.</p>
                </div>
              </div>
            </div>
          )}

          {/* ===== STICKY CATEGORY TABS ===== */}
          <div
            ref={tabsRef}
            className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm"
          >
            <div className="max-w-5xl mx-auto px-4">
              <div className="flex gap-0 overflow-x-auto no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`relative py-3.5 px-4 text-sm font-bold whitespace-nowrap transition-colors shrink-0 ${
                      selectedCategory === cat
                        ? "text-primary"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {cat}
                    {selectedCategory === cat && (
                      <motion.div
                        layoutId="category-underline"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ===== MENU CONTENT ===== */}
          <div className="max-w-5xl mx-auto px-4 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-base text-gray-900">
                {selectedCategory === "All" ? "Full Menu" : selectedCategory}
                <span className="text-gray-400 font-normal text-sm ml-2">
                  ({filteredItems.length})
                </span>
              </h2>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {filteredItems.length > 0 ? (
                  filteredItems.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, type: "spring", stiffness: 300, damping: 30 }}
                      className={`bg-white rounded-2xl border shadow-sm p-4 flex gap-4 ${item.isAvailable ? "border-gray-100" : "border-gray-200 opacity-70 grayscale-[0.2]"}`}
                    >
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Veg/Non-veg indicator */}
                        <div className="mb-1">
                          {isVeg(item.category) ? (
                            <span className="inline-flex items-center justify-center w-4 h-4 border-2 border-green-600 rounded-sm">
                              <span className="w-2 h-2 bg-green-600 rounded-full" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-4 h-4 border-2 border-red-600 rounded-sm">
                              <span className="w-2 h-2 bg-red-600 rounded-full" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-[15px] text-gray-900 line-clamp-1">{item.name}</h3>
                          {!item.isAvailable && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <p className="text-primary font-extrabold text-lg mt-0.5">₹{item.price}</p>
                        <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Image + Add button */}
                      <div className="relative shrink-0 w-28 md:w-32">
                        <img
                          src={item.image || MENU_IMAGES[idx % MENU_IMAGES.length]}
                          alt={item.name}
                          className={`w-full h-24 md:h-28 object-cover rounded-xl shadow-sm ${item.isAvailable ? "" : "grayscale"}`}
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).src = MENU_IMAGES[idx % MENU_IMAGES.length]; }}
                        />
                        {/* ADD / Qty controls */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10">
                          {!hotel.isOpen || !item.isAvailable ? (
                            <button
                              type="button"
                              disabled
                              className="bg-gray-200 text-gray-600 font-extrabold text-sm px-5 py-1.5 rounded-xl shadow-lg cursor-not-allowed"
                            >
                              {hotel.isOpen ? "Unavailable" : "Locked"}
                            </button>
                          ) : (
                            <AnimatePresence mode="wait">
                              {(quantities[item.id] || 0) > 0 ? (
                              <motion.div
                                key="qty"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                className="flex items-center bg-primary text-white rounded-xl shadow-lg overflow-hidden"
                              >
                                <button
                                  onClick={() => setQty(item.id, (quantities[item.id] || 0) - 1)}
                                  className="px-3 py-1.5 hover:bg-orange-600 transition-colors active:scale-90"
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="px-2 font-extrabold text-sm min-w-[22px] text-center">
                                  {quantities[item.id]}
                                </span>
                                <button
                                  onClick={() => setQty(item.id, (quantities[item.id] || 0) + 1)}
                                  className="px-3 py-1.5 hover:bg-orange-600 transition-colors active:scale-90"
                                >
                                  <Plus size={13} />
                                </button>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="add"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                whileTap={{ scale: 0.92 }}
                                onClick={() => setQty(item.id, 1)}
                                className="bg-white border-2 border-primary text-primary font-extrabold text-sm px-5 py-1.5 rounded-xl shadow-lg hover:bg-primary hover:text-white transition-all duration-200"
                              >
                                ADD
                              </motion.button>
                              )}
                            </AnimatePresence>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🍽️</div>
                    <p className="text-gray-500 font-semibold">No items in this category</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Add to cart sticky CTA */}
            <AnimatePresence>
              {totalQty > 0 && hotel.isOpen && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  className="fixed bottom-20 md:bottom-4 left-4 right-4 z-40 max-w-lg mx-auto"
                >
                  <button
                    onClick={() => {
                      filteredItems.forEach((item) => {
                        if ((quantities[item.id] || 0) > 0) handleAddToCart(item);
                      });
                    }}
                    className="w-full btn-primary py-4 text-base shadow-2xl rounded-2xl"
                  >
                    <CartIcon size={20} />
                    Add {totalQty} item{totalQty > 1 ? "s" : ""} to cart
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View cart bar */}
          <AnimatePresence>
            {getItemCount() > 0 && totalQty === 0 && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="fixed bottom-16 md:bottom-4 left-0 right-0 z-30 px-4"
              >
                <div className="max-w-lg mx-auto">
                  <Link
                    to="/cart"
                    className="btn-primary w-full py-4 text-base rounded-2xl shadow-xl flex items-center justify-center gap-2"
                  >
                    <CartIcon size={20} />
                    View Cart ({getItemCount()} items)
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

