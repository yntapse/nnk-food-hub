import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import Header from "@/components/Header";
import { Mail, KeyRound, Lock, ArrowLeft, ShieldCheck } from "lucide-react";

type Step = "email" | "otp";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [testOtp, setTestOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  const startResendCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send OTP"); return; }
      setInfo(data.message);
      if (data.otp) setTestOtp(data.otp);
      setStep("otp");
      startResendCountdown();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setError("");
    setTestOtp("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to resend OTP"); return; }
      setInfo(data.message);
      if (data.otp) setTestOtp(data.otp);
      startResendCountdown();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to reset password"); return; }
      navigate("/login", { state: { successMessage: "Password reset successfully! Please log in with your new password." } });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-yellow-50">
      <Header />

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
              <KeyRound size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold">Forgot Password?</h1>
            <p className="text-muted-foreground mt-1">
              {step === "email"
                ? "Enter your registered email and we'll send you an OTP."
                : "Enter the OTP sent to your email address."}
            </p>
          </div>

          <div className="card-base !p-8">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${step === "email" ? "bg-primary text-white border-primary" : "bg-green-50 text-green-700 border-green-200"}`}>
                {step !== "email" ? <ShieldCheck size={12} /> : <span>1</span>}
                Email
              </div>
              <div className="flex-1 h-px bg-border" />
              <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${step === "otp" ? "bg-primary text-white border-primary" : "bg-secondary text-muted-foreground border-border"}`}>
                <span>2</span>
                New Password
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-xl mb-5 animate-fade-in">
                {error}
              </div>
            )}
            {info && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded-xl mb-5 animate-fade-in">
                {info}
              </div>
            )}
            {testOtp && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded-xl mb-5 animate-fade-in">
                <p className="font-bold mb-0.5">Dev mode — Email not sent</p>
                <p>Use this OTP: <span className="font-mono font-extrabold text-amber-900 text-base tracking-widest">{testOtp}</span></p>
              </div>
            )}

            {/* Step 1 — Email */}
            {step === "email" && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Registered Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="input-base pl-10"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="btn-primary w-full py-3.5 text-base rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
              </form>
            )}

            {/* Step 2 — OTP + New Password */}
            {step === "otp" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold">OTP</label>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={countdown > 0 || loading}
                      className="text-xs text-primary font-semibold hover:underline disabled:text-muted-foreground disabled:no-underline"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                    className="input-base text-center tracking-[0.4em] font-mono text-xl"
                    placeholder="••••••"
                  />
                  <p className="text-xs text-muted-foreground mt-1">OTP sent to <span className="font-semibold">{email}</span></p>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="input-base pl-10"
                      placeholder="Min. 6 characters"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Confirm New Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="input-base pl-10"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="btn-primary w-full py-3.5 text-base rounded-2xl shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(""); setTestOtp(""); setOtp(""); }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={14} /> Back to email
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
