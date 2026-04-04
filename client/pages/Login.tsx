import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { Phone, Lock, CheckCircle } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  const successMessage = (location.state as { successMessage?: string } | null)?.successMessage ?? "";
  const [formData, setFormData] = useState({ identifier: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: formData.identifier.trim(), password: formData.password }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Login failed");
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

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo / brand area */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
              <span className="text-2xl">🍕</span>
            </div>
            <h1 className="text-3xl font-extrabold">Welcome Back</h1>
            <p className="text-muted-foreground mt-1">Login to continue ordering</p>
          </div>

          <div className="card-base !p-8">
            {successMessage && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl mb-5 animate-fade-in">
                <CheckCircle size={15} className="shrink-0" />
                {successMessage}
              </div>
            )}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-xl mb-5 animate-fade-in">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Phone Number or Email
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={handleChange}
                    required
                    className="input-base pl-10"
                    placeholder="Enter mobile number or email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="input-base pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Forgot password */}
              <div className="text-right -mt-1">
                <Link to="/forgot-password" className="text-xs text-primary font-semibold hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 text-base rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary font-bold hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
