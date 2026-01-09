"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const params = useParams();
  const rawToken = (params as any)?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(null);
    setOk(null);

    if (!token) {
      setErr("Invalid or missing token.");
      return;
    }
    if (!password) {
      setErr("Password is required.");
      return;
    }
    if (password !== confirm) {
      setErr("Password confirmation does not match.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        token,
        body: { password },
      });
      setOk("Password updated. You can login now.");
      setPassword("");
      setConfirm("");
    } catch (e: any) {
      setErr(e.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md ui-card p-6">
      <div className="text-xl font-semibold">Reset Password</div>
      <div className="mt-1 text-sm text-(--subtext)">
        Create a new password for your account.
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          type="password"
          className="ui-input"
        />
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          type="password"
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
          {loading ? "Updating..." : "Reset Password"}
        </button>

        {err && <div className="text-(--accent)">{err}</div>}
        {ok && <div className="text-emerald-200">{ok}</div>}
      </div>

      <div className="mt-4 text-sm text-(--subtext)">
        <Link href="/login" className="text-white hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
