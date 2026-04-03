import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { useAuthStore } from "@/stores/authStore";
import { Mail, Lock, User, Phone, MapPin, ShieldCheck, RefreshCw } from "lucide-react";

type UserRole = "user";

const ROLE_OPTIONS: { value: UserRole; label: string; emoji: string }[] = [
  { value: "user", label: "Customer", emoji: "ðŸ‘¤" },
];

export default function Signup() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [role, setRole] = useState<UserRole>("user");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    address: "",
  });
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // If phone changes, reset OTP state
    if (e.target.name === "phone") {
      setOtpSent(false);
      setOtp("");
      setOtpError("");
    }
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setOtpError("");
    const digits = formData.phone.replace(/\D/g, "").replace(/^91/, "").slice(-10);
    if (digits.length !== 10) {
      setOtpError("Enter a valid 10-digit phone number first");
      return;
    }
    setSendingOtp(true);
    try {
      const res = await fetch(apiUrl("/api/auth/send-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error || "Failed to send OTP");
        return;
      }
      setOtpSent(true);
      startCountdown(30);
      // Local fallback mode: show OTP inline
      if (data.otp) {
        setOtpError(`Test OTP: ${data.otp}`);
      }
    } catch {
      setOtpError("Failed to send OTP. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!otpSent) {
      setError("Please verify your phone number with OTP first");
      return;
    }
    if (!otp || otp.length < 6) {
      setError("Please enter the 6-digit OTP sent to your phone");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role,
        otp,
      };
      if (role === "user") payload.address = formData.address;

      const response = await fetch(apiUrl("/api/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

            {/* Role selector */}
            <div className="flex justify-center mb-6">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-semibold transition-all
                    ${role === r.value
                      ? "bg-primary/10 text-primary border-2 border-primary"
                      : "bg-secondary border-2 border-transparent hover:border-primary/30"
                    }`}
                >
                  <span className="text-lg">{r.emoji}</span>
                  {r.label.split(" ")[0]}
                </button>
              ))}
            </div>

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

              {/* Phone + OTP */}
              <div>
                <label className="block text-sm font-semibold mb-2">Phone Number</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      disabled={otpSent && countdown > 0}
                      className="input-base pl-10 disabled:opacity-60"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || countdown > 0}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingOtp ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : countdown > 0 ? (
                      `${countdown}s`
                    ) : otpSent ? (
                      "Resend"
                    ) : (
                      "Send OTP"
                    )}
                  </button>
                </div>

                {otpError && (
                  <p className={`text-xs mt-1.5 ${otpError.startsWith("Test OTP") ? "text-primary font-semibold" : "text-destructive"}`}>
                    {otpError}
                  </p>
                )}

                {otpSent && (
                  <div className="mt-3">
                    <label className="block text-sm font-semibold mb-2 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-primary" /> Enter OTP
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      required
                      className="input-base tracking-[0.4em] text-center font-bold text-lg"
                      placeholder="â€¢ â€¢ â€¢ â€¢ â€¢ â€¢"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Enter the 6-digit OTP sent to your phone</p>
                  </div>
                )}
              </div>

              {role === "user" && (
                <div>
                  <label className="block text-sm font-semibold mb-2">Delivery Address</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" name="address" value={formData.address} onChange={handleChange} className="input-base pl-10" placeholder="Your address" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-2">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" name="password" value={formData.password} onChange={handleChange} required className="input-base pl-10" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="input-base pl-10" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !otpSent}
                className="btn-primary w-full py-3.5 text-base rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? "Creating account..." : !otpSent ? "Verify Phone to Continue" : "Create Account"}
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

