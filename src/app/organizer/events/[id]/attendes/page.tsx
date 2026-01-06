"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type AttendeeItem = {
  customer: { id: number; name: string; email: string };
  qty: number;
  totalPaid: number;
};

type AttendeesRes = {
  event: { id: number; name: string };
  items: AttendeeItem[];
};

export default function AttendeesPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const authToken = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [data, setData] = useState<AttendeesRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "ORGANIZER") {
      router.push("/");
      return;
    }
    if (!authToken) {
      setErr("Token tidak ditemukan. Coba logout lalu login lagi.");
      setBusy(false);
      return;
    }
    if (!id) return;

    setBusy(true);
    setErr(null);
    api<AttendeesRes>(`/organizer/events/${id}/attendees`, { token: authToken })
      .then(setData)
      .catch((e: any) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [loading, user, authToken, id, router]);

  if (busy) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
        Loading attendees…
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-(--accent)/40 bg-(--accent)/10 p-4 text-sm">
          {err}
        </div>
        <Link href="/organizer" className="inline-block px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
          Back
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm">
        Not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Attendees</div>
            <div className="mt-1 text-sm text-(--subtext)">
              Event: <span className="text-white">{data.event.name}</span>
            </div>
          </div>

          <Link
            href="/organizer"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-(--subtext) border-b border-white/10">
          <div className="col-span-6">Customer</div>
          <div className="col-span-2">Qty</div>
          <div className="col-span-4 text-right">Total Paid</div>
        </div>

        {data.items.length === 0 ? (
          <div className="p-6 text-sm text-(--subtext)">Belum ada attendee (DONE) untuk event ini.</div>
        ) : (
          data.items.map((it) => (
            <div key={it.customer.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm">
              <div className="col-span-6">
                <div className="font-semibold">{it.customer.name}</div>
                <div className="text-xs text-(--subtext)">{it.customer.email}</div>
              </div>
              <div className="col-span-2">{it.qty}</div>
              <div className="col-span-4 text-right">{formatIDR(it.totalPaid)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
