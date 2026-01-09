"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null);
    setOk(null);

    if (!email.trim()) {
      setErr("Email is required.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim() },
      });
      setOk("Reset link sent. Please check your email.");
      setEmail("");
    } catch (e: any) {
      setErr(e.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-(--surface) p-6">
      <div className="text-xl font-semibold">Forgot Password</div>
      <div className="mt-1 text-sm text-(--subtext)">
        We will send a reset link to your email.
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 outline-none"
        />

        <button
          onClick={submit}
          disabled={loading}
          className={`w-full rounded-xl px-4 py-3 border ${
            loading
              ? "bg-white/5 border-white/10 text-(--subtext) cursor-not-allowed"
              : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
          }`}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        {err && <div className="text-(--accent)">{err}</div>}
        {ok && <div className="text-emerald-200">{ok}</div>}
      </div>

      <div className="mt-4 text-sm text-(--subtext)">
        Remembered your password?{" "}
        <Link href="/login" className="text-white hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
