"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

type Voucher = {
  id: number;
  code: string;
  discountAmount: number;
  startAt: string;
  endAt: string;
  maxUses: number | null;
  usedCount: number;
};

type TicketType = {
  id: number;
  name: string;
  price: number;
  remainingSeats: number;
};

type EventDetail = {
  id: number;
  name: string;
  description: string;
  category: string;
  location: string;
  startAt: string;
  endAt: string;
  price: number;
  totalSeats: number;
  remainingSeats: number;
  isPublished: boolean;
  imageUrl?: string | null; // ✅
  organizer: { id: number; name: string };
  ticketTypes: TicketType[];
  vouchers: Voucher[];
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [data, setData] = useState<EventDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [qty, setQty] = useState<number>(1);
  const [voucherCode, setVoucherCode] = useState<string>("");
  const [pointsUsed, setPointsUsed] = useState<number>(0);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    api<EventDetail>(`/events/${id}`)
      .then((res) => setData(res))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const canCheckout = useMemo(() => {
    if (!data) return false;
    if (data.remainingSeats <= 0) return false;
    if (qty < 1) return false;
    if (qty > data.remainingSeats) return false;
    return true;
  }, [data, qty]);

  const checkout = async () => {
    setErr(null);

    if (!token) {
      router.push("/login");
      return;
    }
    if (!data) return;
    if (!canCheckout) {
      setErr("Qty tidak valid / seat tidak cukup");
      return;
    }

    try {
      const body: any = { eventId: data.id, qty };
      if (voucherCode.trim()) body.voucherCode = voucherCode.trim();
      if (pointsUsed > 0) body.pointsUsed = pointsUsed;

      await api(`/transactions`, { method: "POST", token, body });
      router.push("/transactions");
    } catch (e: any) {
      setErr(e.message);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
        Loading event…
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-(--accent)/40 bg-(--accent)/10 p-4 text-sm">
          {err}
        </div>
        <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
          Back to events
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm">
        Event not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner Image */}
      <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.name} className="w-full h-70 object-cover border-b border-white/10" />
        ) : (
          <div className="w-full h-70 bg-white/5 flex items-center justify-center text-sm text-(--subtext)">
            No image
          </div>
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold">{data.name}</div>
              <div className="mt-1 text-sm text-(--subtext)">
                {data.category} • {data.location}
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-(--subtext)">Price</div>
              <div className="text-xl font-semibold">
                {data.price === 0 ? "Free" : formatIDR(data.price)}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-(--text)/90 whitespace-pre-line">
            {data.description}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-(--subtext)">Schedule</div>
              <div className="mt-1 text-sm">
                {new Date(data.startAt).toLocaleString("id-ID")} —{" "}
                {new Date(data.endAt).toLocaleString("id-ID")}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-(--subtext)">Seats</div>
              <div className="mt-1 text-sm">
                Remaining <span className="font-semibold">{data.remainingSeats}</span> / {data.totalSeats}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-(--subtext)">Organizer</div>
              <div className="mt-1 text-sm font-semibold">{data.organizer.name}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout */}
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Checkout</div>
            <div className="text-sm text-(--subtext) mt-1">Buat transaksi untuk event ini.</div>
          </div>

          {!user ? (
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl bg-(--primary)/25 hover:bg-(--primary)/35 border border-(--primary)/40 text-sm"
            >
              Login dulu
            </Link>
          ) : (
            <div className="text-xs text-(--subtext)">
              Logged in as <span className="text-white">{user.role}</span>
            </div>
          )}
        </div>

        {user?.role === "ORGANIZER" && (
          <div className="mt-3 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            Organizer tidak bisa checkout. Login sebagai CUSTOMER.
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Qty</div>
            <input
              type="number"
              min={1}
              max={data.remainingSeats}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Voucher (optional)</div>
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder="PROMO20"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Points used (optional)</div>
            <input
              type="number"
              min={0}
              value={pointsUsed}
              onChange={(e) => setPointsUsed(Number(e.target.value))}
              placeholder="5000"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>
        </div>

        <button
          disabled={!user || user.role !== "CUSTOMER" || !canCheckout}
          onClick={checkout}
          className={`mt-4 w-full px-4 py-3 rounded-xl text-sm border ${
            user && user.role === "CUSTOMER" && canCheckout
              ? "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
              : "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
          }`}
        >
          Create Transaction
        </button>

        {data.vouchers?.length > 0 && (
          <div className="mt-4 text-sm">
            <div className="text-(--subtext) text-xs mb-2">Active vouchers</div>
            <div className="flex flex-wrap gap-2">
              {data.vouchers.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoucherCode(v.code)}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                >
                  {v.code} — {formatIDR(v.discountAmount)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
