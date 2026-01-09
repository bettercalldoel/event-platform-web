"use client";

import { useAuth } from "@/lib/auth";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md ui-card p-6">
      <div className="text-xl font-semibold">Login</div>
      <div className="mt-1 text-sm text-[var(--subtext)]">Masuk untuk membeli tiket / kelola event.</div>

      <div className="mt-4 space-y-3 text-sm">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="ui-input"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="ui-input"
        />
        <button
          onClick={async () => {
            setErr(null);
            try {
              await login(email, password);
            } catch (e: any) {
              setErr(e.message);
            }
          }}
          className="w-full ui-btn ui-btn-primary"
        >
          Login
        </button>
        <div className="text-xs text-[var(--subtext)]">
          <Link href="/forgot-password" className="text-white hover:underline">
            Forgot password?
          </Link>
        </div>
        {err && <div className="text-[var(--accent)]">{err}</div>}
      </div>
    </div>
  );
}
