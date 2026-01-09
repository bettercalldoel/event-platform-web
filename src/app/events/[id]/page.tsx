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
  imageUrl?: string | null;

  organizer: { id: number; name: string };
  ticketTypes: TicketType[];
  vouchers: Voucher[];
};

type ReviewItem = {
  id: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { id: number; name: string };
};

type ReviewListRes = {
  summary: { avgRating: number | null; totalReviews: number };
  items: ReviewItem[];
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user } = useAuth();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return v ? String(v) : "";
  }, [params]);

  const [data, setData] = useState<EventDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // checkout
  const [qty, setQty] = useState<number>(1);
  const [voucherCode, setVoucherCode] = useState<string>("");
  const [couponCode, setCouponCode] = useState<string>("");
  const [extraVoucherOpen, setExtraVoucherOpen] = useState(false);
  const [pointsUsed, setPointsUsed] = useState<number>(0);

  // reviews
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsErr, setReviewsErr] = useState<string | null>(null);
  const [reviewSummary, setReviewSummary] = useState<ReviewListRes["summary"]>({
    avgRating: null,
    totalReviews: 0,
  });
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);


  const loadEvent = async () => {
    if (!id) return;
    const res = await api<EventDetail>(`/events/${id}`);
    setData(res);
  };

  const loadReviews = async () => {
    if (!id) return;

    setReviewsLoading(true);
    setReviewsErr(null);
    try {
      // ✅ PENTING: pakai api() biar ke port 4000, bukan /events/... di 3000
      const res = await api<ReviewListRes>(`/events/${id}/reviews`);
      setReviewSummary(res.summary);
      setReviewItems(res.items ?? []);
    } catch (e: any) {
      setReviewsErr(e.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    Promise.all([loadEvent(), loadReviews()])
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const body: any = {
        eventId: data.id,
        qty,
      };
      if (voucherCode.trim()) body.voucherCode = voucherCode.trim();
      if (couponCode.trim()) body.couponCode = couponCode.trim();
      if (pointsUsed > 0) body.pointsUsed = pointsUsed;

      const res = await api(`/transactions`, {
        method: "POST",
        token,
        body,
      });

      const trxId = (res as any)?.transaction?.id;
      if (trxId) router.push("/customer");
      else router.push("/customer");
    } catch (e: any) {
      setErr(e.message);
    }
  };


  if (loading) {
    return (
      <div className="ui-card p-6 text-sm text-(--subtext)">
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
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
        >
          Back to events
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ui-card p-6 text-sm">
        Event not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HERO */}
      <div className="ui-card overflow-hidden">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.name} className="h-56 w-full object-cover" />
        ) : (
          <div className="h-56 w-full bg-white/5 flex items-center justify-center text-xs text-(--subtext)">
            No Image
          </div>
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold">{data.name}</div>
              <div className="mt-1 text-sm text-(--subtext)">
                <Link
                  href={`/?category=${encodeURIComponent(data.category)}`}
                  className="text-white/80 hover:text-white hover:underline"
                >
                  {data.category}
                </Link>{" "}
                • {data.location}
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
            <div className="ui-panel p-3">
              <div className="text-xs text-(--subtext)">Schedule</div>
              <div className="mt-1 text-sm">
                {new Date(data.startAt).toLocaleString("id-ID")} —{" "}
                {new Date(data.endAt).toLocaleString("id-ID")}
              </div>
            </div>

            <div className="ui-panel p-3">
              <div className="text-xs text-(--subtext)">Seats</div>
              <div className="mt-1 text-sm">
                Remaining <span className="font-semibold">{data.remainingSeats}</span> /{" "}
                {data.totalSeats}
              </div>
            </div>

            <div className="ui-panel p-3">
              <div className="text-xs text-(--subtext)">Organizer</div>
              <Link
                href={`/organizers/${data.organizer.id}`}
                className="mt-1 inline-block text-sm font-semibold text-white hover:underline"
              >
                {data.organizer.name}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* CHECKOUT */}
      <div className="ui-card p-6">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Qty</div>
            <input
              type="number"
              min={1}
              max={data.remainingSeats}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">
              Event voucher code (optional)
            </div>
            <input
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
              placeholder="PROMO20"
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Points used (optional)</div>
            <input
              type="number"
              min={0}
              value={pointsUsed}
              onChange={(e) => setPointsUsed(Number(e.target.value))}
              placeholder="5000"
              className="ui-input mt-2"
            />
          </div>

          {extraVoucherOpen && (
            <div className="ui-panel p-3">
              <div className="text-xs text-(--subtext)">
                Referral voucher code (optional)
              </div>
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="REF-XXXX"
                className="ui-input mt-2"
              />
            </div>
          )}
        </div>

        <div className="mt-3">
          {extraVoucherOpen ? (
            <button
              type="button"
              onClick={() => {
                setExtraVoucherOpen(false);
                setCouponCode("");
              }}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs"
            >
              Remove extra voucher
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExtraVoucherOpen(true)}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs"
            >
              Add another voucher
            </button>
          )}
        </div>

        <div className="mt-2 text-xs text-(--subtext)">
          Event vouchers are created by the organizer. Referral vouchers come from
          another user’s referral code.
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

      {/* REVIEWS */}
      <div className="ui-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Reviews</div>
            <div className="text-sm text-(--subtext) mt-1">
              Avg:{" "}
              <span className="text-white">
                {reviewSummary.avgRating === null ? "-" : reviewSummary.avgRating.toFixed(1)}
              </span>{" "}
              • Total: <span className="text-white">{reviewSummary.totalReviews}</span>
            </div>
          </div>

          <button
            onClick={() => loadReviews()}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
          >
            Refresh
          </button>
        </div>

        {reviewsErr && (
          <div className="rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {reviewsErr}
          </div>
        )}

        {reviewsLoading ? (
          <div className="text-sm text-(--subtext)">Loading reviews…</div>
        ) : reviewItems.length === 0 ? (
          <div className="text-sm text-(--subtext)">Belum ada review.</div>
        ) : (
          <div className="space-y-3">
            {reviewItems.map((r) => (
              <div key={r.id} className="ui-panel p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{r.user.name}</div>
                  <div className="text-xs text-(--subtext)">
                    {new Date(r.createdAt).toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="mt-1 text-sm">
                  Rating: <span className="font-semibold">{r.rating}</span>/5
                </div>
                {r.comment && <div className="mt-2 text-sm text-(--text)/90">{r.comment}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="ui-panel p-4 text-sm text-(--subtext)">
          Write a review from your customer dashboard after the event ends.
        </div>
      </div>
    </div>
  );
}
