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
    <div className="mx-auto max-w-md ui-card p-6">
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
          className="ui-input"
        />

        <button
          onClick={submit}
          disabled={loading}
          className={`w-full ui-btn ${
            loading
              ? "ui-btn-muted text-(--subtext) cursor-not-allowed"
              : "ui-btn-primary"
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
