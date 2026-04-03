import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import {
  Search, Star, MapPin, Clock, Flame, TrendingUp, Leaf,
  IndianRupee, ChevronLeft, ChevronRight, Zap, Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Hotel {
  id: number;
  name: string;
  location: string;
  category: string;
  rating: number;
  isOpen: boolean;
}

/* Hero carousel slides */
const HERO_SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80",
    badge: "🔥 Trending Now",
    title: "Order food in\nyour town",
    subtitle: "Fast delivery · Fresh food · Great prices",
    gradient: "from-orange-950/80 via-orange-800/50 to-transparent",
  },
  {
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&q=80",
    badge: "🍔 Best Sellers",
    title: "Burgers &\nBeyond",
    subtitle: "Juicy, fresh & delivered to your door",
    gradient: "from-red-950/80 via-red-800/50 to-transparent",
  },
  {
    image: "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=900&q=80",
    badge: "🍚 Local Favourites",
    title: "Biryani &\nDesi Cuisines",
    subtitle: "Authentic flavours from local chefs",
    gradient: "from-amber-950/80 via-amber-800/50 to-transparent",
  },
];

/* Food images for cards */
const FOOD_IMAGES = [
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
  "https://images.unsplash.com/photo-1631515243349-e0cb75fb8d3a?w=600&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&q=80",
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
type QuickFilter = "all" | "fast" | "topRated" | "veg";

/* Skeleton card */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
      <div className="skeleton-shimmer h-44 w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton-shimmer h-5 w-3/4 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-1/2 rounded-lg" />
        <div className="flex gap-2">
          <div className="skeleton-shimmer h-6 w-16 rounded-full" />
          <div className="skeleton-shimmer h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* Hero Carousel */
function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback((idx: number, dir: number) => {
    setDirection(dir);
    setCurrent(idx);
  }, []);

  const next = useCallback(() => {
    go((current + 1) % HERO_SLIDES.length, 1);
  }, [current, go]);

  const prev = useCallback(() => {
    go((current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length, -1);
  }, [current, go]);

  useEffect(() => {
    timerRef.current = setTimeout(next, 4500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [next]);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  const slide = HERO_SLIDES[current];

  return (
    <div className="relative h-[56vw] min-h-[280px] max-h-[500px] overflow-hidden bg-gray-900 select-none">
      <AnimatePresence custom={direction} initial={false}>
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "tween", duration: 0.45, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background image */}
          <img
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
          {/* Gradient overlay */}
          <div className={`absolute inset-0 bg-gradient-to-r ${slide.gradient}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Text content */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 max-w-lg">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="inline-block self-start mb-3 px-3 py-1 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-xs font-bold rounded-full"
            >
              {slide.badge}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-5xl font-extrabold text-white leading-tight whitespace-pre-line mb-2 drop-shadow-lg"
            >
              {slide.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="text-white/80 text-sm md:text-base mb-1"
            >
              {slide.subtitle}
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next buttons */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all z-10"
        aria-label="Previous slide"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center transition-all z-10"
        aria-label="Next slide"
      >
        <ChevronRight size={18} />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i, i > current ? 1 : -1)}
            className={`rounded-full transition-all duration-300 ${
              i === current ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50 hover:bg-white/80"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
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
  const searchRef = useRef<HTMLInputElement>(null);

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

  /* Framer-motion variants */
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  };
  const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 28 } },
  };
  const chipVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    show: { opacity: 1, scale: 1, transition: { type: "spring" as const, stiffness: 400, damping: 25 } },
  };

  return (
    <div className="min-h-screen bg-[#fafafa] pb-nav md:pb-8">
      <Header />

      {/* ===== HERO CAROUSEL ===== */}
      <HeroCarousel />

      {/* ===== FLOATING SEARCH BAR ===== */}
      <div className="relative z-20 -mt-6 px-4 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl shadow-black/10 flex items-center gap-3 px-4 py-3.5 border border-gray-100">
          <Search size={20} className="text-orange-400 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search restaurants, cuisines, dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent text-foreground placeholder-gray-400 focus:outline-none text-sm md:text-base"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xs font-semibold"
            >
              âœ•
            </button>
          )}
        </div>
      </div>

      {/* ===== CUISINE CHIPS ===== */}
      <section className="pt-8 pb-2 px-4 max-w-7xl mx-auto">
        <h2 className="text-lg font-extrabold mb-4 text-foreground">What are you craving?</h2>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex gap-3 overflow-x-auto no-scrollbar pb-1"
        >
          {categories.map((cat) => (
            <motion.button
              key={cat}
              variants={chipVariants}
              onClick={() => setSelectedCategory(cat)}
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl transition-all duration-200 shrink-0 border ${
                selectedCategory === cat
                  ? "bg-orange-50 border-primary shadow-md shadow-primary/15 ring-2 ring-primary/30"
                  : "bg-white border-gray-100 hover:shadow-md hover:border-gray-200"
              }`}
            >
              <span className="text-2xl leading-none">{CUISINE_ICONS[cat] || "🍽️"}</span>
              <span className={`text-[11px] font-bold whitespace-nowrap ${selectedCategory === cat ? "text-primary" : "text-gray-600"}`}>
                {cat}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </section>

      {/* ===== QUICK FILTERS ===== */}
      <section className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {([
            { key: "all", label: "All", icon: null },
            { key: "fast", label: "Fast Delivery", icon: <Zap size={12} className="text-yellow-500" /> },
            { key: "topRated", label: "Top Rated", icon: <TrendingUp size={12} /> },
            { key: "veg", label: "Pure Veg", icon: <Leaf size={12} className="text-green-500" /> },
          ] as const).map(({ key, label, icon }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.92 }}
              onClick={() => setQuickFilter(key)}
              className={`chip flex items-center gap-1 text-xs shrink-0 ${quickFilter === key ? "chip-active" : ""}`}
            >
              {icon}{label}
            </motion.button>
          ))}
          <div className="w-px h-5 bg-gray-200 shrink-0 mx-1" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="chip bg-white appearance-none pr-5 cursor-pointer text-xs shrink-0"
          >
            <option value="rating">⭐ By Rating</option>
            <option value="name">📝 By Name</option>
          </select>
        </div>
      </section>

      {/* ===== RESTAURANT GRID ===== */}
      <section id="restaurants" className="max-w-7xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-foreground">
            {loading ? "Loading…" : `${filteredHotels.length} Restaurant${filteredHotels.length !== 1 ? "s" : ""} near you`}
          </h2>
          {!loading && filteredHotels.length > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={12} /> Niphad
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredHotels.length > 0 ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredHotels.map((hotel, idx) => (
              <motion.div key={hotel.id} variants={cardVariants}>
                <Link
                  to={`/restaurant/${hotel.id}`}
                  className={`group block bg-white rounded-2xl overflow-hidden border shadow-sm transition-all duration-300 ${hotel.isOpen ? "border-gray-100 hover:shadow-xl hover:-translate-y-1" : "border-gray-200 opacity-90"}`}
                >
                  {/* Image */}
                  <div className={`relative h-44 overflow-hidden bg-gray-100 ${hotel.isOpen ? "" : "grayscale"}`}>
                    <img
                      src={FOOD_IMAGES[idx % FOOD_IMAGES.length]}
                      alt={hotel.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ${hotel.isOpen ? "group-hover:scale-105" : "scale-100"}`}
                      loading="lazy"
                    />
                    {/* Gradient overlay */}
                    <div className={`absolute inset-0 ${hotel.isOpen ? "bg-gradient-to-t from-black/55 via-black/10 to-transparent" : "bg-gradient-to-t from-black/75 via-black/35 to-black/20"}`} />

                    {/* Bottom-left: Rating */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm text-gray-800 px-2 py-0.5 rounded-lg text-sm font-bold shadow-sm">
                      <Star size={12} className="text-yellow-500 fill-yellow-500" />
                      {hotel.rating.toFixed(1)}
                    </div>

                    {/* Bottom-right: Status */}
                    <div className="absolute bottom-3 right-3">
                      {hotel.isOpen ? (
                        <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Open
                        </span>
                      ) : (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Closed
                        </span>
                      )}
                    </div>

                    {!hotel.isOpen && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-2 border border-white/30">
                          <Lock size={18} />
                        </div>
                        <p className="text-sm font-extrabold">Restaurant is offline</p>
                        <p className="text-[11px] text-white/80">Ordering is unavailable right now</p>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className={`font-extrabold text-[15px] transition-colors line-clamp-1 mb-1 ${hotel.isOpen ? "text-gray-900 group-hover:text-primary" : "text-gray-700"}`}>
                      {hotel.name}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-gray-400" />
                        20–30 min
                      </span>
                      <span className="flex items-center gap-1">
                        <IndianRupee size={12} className="text-gray-400" />
                        200 for two
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-[11px] font-bold px-2.5 py-1 rounded-full border border-orange-100">
                        {CUISINE_ICONS[hotel.category] || "🍽️"} {hotel.category}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        <MapPin size={11} />
                        {hotel.location}
                      </span>
                    </div>

                    <div className="mt-3">
                      <span className={`inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-bold transition ${hotel.isOpen ? "bg-primary text-white group-hover:brightness-110" : "bg-gray-200 text-gray-700"}`}>
                        {hotel.isOpen ? "View Menu" : "View Menu • Ordering Locked"}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-extrabold mb-2">No restaurants found</h3>
            <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
            <button
              onClick={() => { setSearchTerm(""); setSelectedCategory("All"); setQuickFilter("all"); }}
              className="mt-4 btn-primary text-sm"
            >
              Clear filters
            </button>
          </motion.div>
        )}
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="mt-8 bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="/niphad-bites-logo2.jpeg"
                  alt="Niphad Bites logo"
                  className="w-12 h-12 rounded-2xl object-cover border border-white/10"
                />
                <span className="font-extrabold text-white text-base">Niphad Bites</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your favourite food, delivered fast.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 text-sm">Company</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><a href="#" className="hover:text-white transition">About us</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 text-sm">For Business</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><a href="#" className="hover:text-white transition">Partner with us</a></li>
                <li><a href="#" className="hover:text-white transition">Become a rider</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-3 text-sm">Legal</h4>
              <ul className="space-y-2 text-xs text-gray-400">
                <li><a href="#" className="hover:text-white transition">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Niphad Bites. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

