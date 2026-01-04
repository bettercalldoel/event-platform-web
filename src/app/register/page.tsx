"use client";

import { useAuth } from "@/lib/auth";
import { useState } from "react";

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "ORGANIZER">("CUSTOMER");
  const [referralCodeUsed, setReferral] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[var(--surface)] p-6">
      <div className="text-xl font-semibold">Register</div>
      <div className="mt-1 text-sm text-[var(--subtext)]">Buat akun customer atau organizer.</div>

      <div className="mt-4 space-y-3 text-sm">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
          className="w-full rounded-xl bg-[var(--muted)] border border-white/10 px-4 py-3 outline-none" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          className="w-full rounded-xl bg-[var(--muted)] border border-white/10 px-4 py-3 outline-none" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6)"
          type="password"
          className="w-full rounded-xl bg-[var(--muted)] border border-white/10 px-4 py-3 outline-none" />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="w-full rounded-xl bg-[var(--muted)] border border-white/10 px-4 py-3 outline-none"
        >
          <option value="CUSTOMER">Customer</option>
          <option value="ORGANIZER">Organizer</option>
        </select>

        <input value={referralCodeUsed} onChange={(e) => setReferral(e.target.value)}
          placeholder="Referral code (optional)"
          className="w-full rounded-xl bg-[var(--muted)] border border-white/10 px-4 py-3 outline-none" />

        <button
          onClick={async () => {
            setErr(null);
            try {
              await register({ name, email, password, role, referralCodeUsed: referralCodeUsed || undefined });
            } catch (e: any) {
              setErr(e.message);
            }
          }}
          className="w-full rounded-xl px-4 py-3 bg-[var(--primary)]/25 hover:bg-[var(--primary)]/35 border border-[var(--primary)]/40"
        >
          Register
        </button>

        {err && <div className="text-[var(--accent)]">{err}</div>}
      </div>
    </div>
  );
}
