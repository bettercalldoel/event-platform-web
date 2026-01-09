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
    <div className="mx-auto max-w-md ui-card p-6">
      <div className="text-xl font-semibold">Register</div>
      <div className="mt-1 text-sm text-[var(--subtext)]">Buat akun customer atau organizer.</div>

      <div className="mt-4 space-y-3 text-sm">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="ui-input"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="ui-input"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6)"
          type="password"
          className="ui-input"
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          className="ui-input"
        >
          <option value="CUSTOMER">Customer</option>
          <option value="ORGANIZER">Organizer</option>
        </select>

        <input
          value={referralCodeUsed}
          onChange={(e) => setReferral(e.target.value)}
          placeholder="Referral code (optional)"
          className="ui-input"
        />

        <button
          onClick={async () => {
            setErr(null);
            try {
              await register({ name, email, password, role, referralCodeUsed: referralCodeUsed || undefined });
            } catch (e: any) {
              setErr(e.message);
            }
          }}
          className="w-full ui-btn ui-btn-primary"
        >
          Register
        </button>

        {err && <div className="text-[var(--accent)]">{err}</div>}
      </div>
    </div>
  );
}
