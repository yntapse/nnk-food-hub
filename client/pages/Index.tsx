import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { Search, Star, MapPin, Clock, Flame, TrendingUp, Leaf, IndianRupee, SlidersHorizontal } from "lucide-react";

interface Hotel {
  id: number;
  name: string;
  location: string;
  category: string;
  rating: number;
  isOpen: boolean;
}

/* Food images for hero & cards */
const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80", // pizza
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80", // burger
  "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&q=80", // biryani
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80", // meat
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80", // platter
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&q=80", // pasta
];

const CUISINE_ICONS: Record<string, string> = {
  "All": "🍽️",
  "Fast Food": "🍔",
  "Biryani": "🍚",
  "Pizza": "🍕",
  "Chinese": "🥡",
  "South Indian": "🫕",
  "Desserts": "🍰",
  "Beverages": "🥤",
};

type SortKey = "rating" | "name";
type QuickFilter = "all" | "fast" | "topRated" | "veg" | "under200";

function SkeletonCard() {
  return (
    <div className="restaurant-card animate-pulse">
      <div className="skeleton h-44 w-full rounded-none rounded-t-2xl" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/2" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("rating");

  const categories = ["All", "Fast Food", "Biryani", "Pizza", "Chinese", "South Indian", "Desserts", "Beverages"];

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl("/api/hotels"));
        if (res.ok) setHotels(await res.json());
      } catch (e) {
        console.error("Error fetching hotels:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Derived filtered + sorted list */
  const filteredHotels = hotels
    .filter((h) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!h.name.toLowerCase().includes(q) && !h.location.toLowerCase().includes(q) && !h.category.toLowerCase().includes(q)) return false;
      }
      if (selectedCategory !== "All" && h.category !== selectedCategory) return false;
      if (quickFilter === "topRated" && h.rating < 4) return false;
      if (quickFilter === "veg" && !["South Indian", "Desserts", "Beverages"].includes(h.category)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rating") return b.rating - a.rating;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-primary to-red-500 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-0 -left-16 w-56 h-56 bg-white/5 rounded-full blur-2xl" />

        <div className="relative max-w-7xl mx-auto px-4 py-14 md:py-20 flex flex-col md:flex-row items-center gap-8">
          {/* Left text */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-4 drop-shadow-lg">
              Order food&nbsp;
              <span className="text-yellow-300">in your town</span>
            </h1>
            <p className="text-lg md:text-xl text-white/85 mb-8 max-w-lg mx-auto md:mx-0">
              Fast delivery from the best local restaurants. Fresh food, great prices, right at your doorstep.
            </p>

            {/* Search */}
            <div className="relative max-w-xl mx-auto md:mx-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search restaurants, cuisines, dishes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl text-foreground bg-white placeholder-gray-400
                  focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl text-base"
              />
            </div>
          </div>

          {/* Right: food images collage (desktop) */}
          <div className="hidden md:grid grid-cols-2 gap-3 flex-shrink-0 w-80 lg:w-96">
            {FOOD_IMAGES.slice(0, 4).map((src, i) => (
              <img
                key={i}
                src={src}
                alt="food"
                className={`rounded-2xl object-cover shadow-lg ${i === 0 ? "h-36 col-span-1" : i === 1 ? "h-36" : i === 2 ? "h-32" : "h-32"} w-full`}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== QUICK FILTERS BAR ===== */}
      <section className="border-b border-border bg-white sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar">
          <SlidersHorizontal size={16} className="text-muted-foreground shrink-0" />
          {([
            { key: "all",      label: "All",           icon: null },
            { key: "fast",     label: "Fast Delivery",  icon: <Flame size={14} /> },
            { key: "topRated", label: "Top Rated",      icon: <TrendingUp size={14} /> },
            { key: "veg",      label: "Pure Veg",       icon: <Leaf size={14} /> },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setQuickFilter(key)}
              className={`chip flex items-center gap-1.5 ${quickFilter === key ? "chip-active" : ""}`}
            >
              {icon}
              {label}
            </button>
          ))}

          <div className="w-px h-6 bg-border shrink-0" />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="chip bg-white appearance-none pr-6 cursor-pointer"
          >
            <option value="rating">Sort: Rating</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </section>

      {/* ===== CUISINE CHIPS ===== */}
      <section className="max-w-7xl mx-auto px-4 pt-8 pb-4">
        <h2 className="text-xl font-bold mb-4">What are you craving?</h2>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all duration-200 shrink-0
                ${selectedCategory === cat
                  ? "bg-primary/10 ring-2 ring-primary text-primary"
                  : "bg-white border border-border hover:shadow-md text-foreground"
                }`}
            >
              <span className="text-2xl">{CUISINE_ICONS[cat] || "🍽️"}</span>
              <span className="text-xs font-semibold whitespace-nowrap">{cat}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== RESTAURANT GRID ===== */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">
            {filteredHotels.length} Restaurant{filteredHotels.length !== 1 ? "s" : ""} near you
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredHotels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHotels.map((hotel, idx) => (
              <Link
                key={hotel.id}
                to={`/restaurant/${hotel.id}`}
                className="restaurant-card group animate-fade-in"
                style={{ animationDelay: `${idx * 50}ms`, animationFillMode: "backwards" }}
              >
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={FOOD_IMAGES[idx % FOOD_IMAGES.length]}
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                  {/* Promoted badge (every 3rd) */}
                  {idx % 3 === 0 && (
                    <span className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                      PROMOTED
                    </span>
                  )}

                  {/* Rating pill */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm text-foreground px-2.5 py-1 rounded-lg shadow-sm">
                    <Star size={13} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold">{hotel.rating.toFixed(1)}</span>
                  </div>

                  {/* Open/Closed */}
                  <div className="absolute bottom-3 right-3">
                    {hotel.isOpen ? (
                      <span className="badge-success">Open</span>
                    ) : (
                      <span className="badge-closed">Closed</span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {hotel.name}
                  </h3>

                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={13} />
                      20-30 min
                    </span>
                    <span className="flex items-center gap-1">
                      <IndianRupee size={13} />
                      200 for two
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="badge-muted">{hotel.category}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={12} />
                      {hotel.location}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-bold mb-2">No restaurants found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold text-white mb-4">Niphad Food Hub</h4>
              <p className="text-sm text-gray-400 leading-relaxed">
                Your favourite food, delivered fast to your doorstep.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">About us</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">For Business</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Partner with us</a></li>
                <li><a href="#" className="hover:text-white transition">Become a rider</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} FoodHub. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
