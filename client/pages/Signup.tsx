import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { Mail, Lock, User, Phone, MapPin } from "lucide-react";

export default function Signup() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          address: formData.address,
          role: "user",
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Signup failed");
        return;
      }
      const data = await response.json();
      setUser(data.user, data.token);
      navigate("/dashboard");
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-yellow-50">
      <Header />

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="text-center mb-8">
            <img
              src="/niphad-bites-logo2.jpeg"
              alt="Niphad Bites logo"
              className="w-24 h-24 rounded-3xl object-cover mx-auto mb-4 shadow-lg shadow-primary/20 border border-orange-100"
            />
            <h1 className="text-3xl font-extrabold">Create Account</h1>
            <p className="text-muted-foreground mt-1">Join Niphad Bites today</p>
          </div>

          <div className="card-base !p-8">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-xl mb-5 animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required className="input-base pl-10" placeholder="John Doe" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" name="email" value={formData.email} onChange={handleChange} required className="input-base pl-10" placeholder="you@example.com" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Phone Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    inputMode="numeric"
                    maxLength={10}
                    className="input-base pl-10"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Delivery Address</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" name="address" value={formData.address} onChange={handleChange} className="input-base pl-10" placeholder="Your address" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" name="password" value={formData.password} onChange={handleChange} required className="input-base pl-10" placeholder="Min. 6 characters" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="input-base pl-10" placeholder="Re-enter password" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 text-base rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-bold hover:underline">
                  Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

