"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

type Trx = {
  id: number;
  status: string;
  qty: number;
  totalAmount: number;
  paymentDueAt: string;
  paymentRemainingSeconds?: number | null;
  paymentProofUrl?: string | null;
  event: { id: number; name: string; startAt?: string; location?: string; imageUrl?: string | null };
};

type AttendedEvent = {
  id: number;
  name: string;
  category: string;
  location: string;
  startAt: string;
  endAt: string;
  imageUrl?: string | null;
  organizer: { id: number; name: string };
  myReview: { id: number; rating: number; comment: string | null; createdAt: string } | null;
};

type TabKey = "transactions" | "attended" | "account";

type ReferralSummary = {
  referralCode: string;
  referralPoints: number;
};

type CouponItem = {
  id: number;
  code: string;
  discountAmount: number;
  expiresAt: string;
};

function formatDateShort(dateISO: string) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm border transition ${
        active
          ? "bg-(--primary)/25 border-(--primary)/40"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

export default function CustomerDashboard({ initialTab = "transactions" }: { initialTab?: TabKey }) {
  const { user, token, loading } = useAuth();

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [items, setItems] = useState<Trx[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  const [attended, setAttended] = useState<AttendedEvent[]>([]);
  const [attErr, setAttErr] = useState<string | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [referralErr, setReferralErr] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [couponErr, setCouponErr] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [reviewOpenById, setReviewOpenById] = useState<Record<number, boolean>>({});
  const [reviewRatingById, setReviewRatingById] = useState<Record<number, number>>({});
  const [reviewCommentById, setReviewCommentById] = useState<Record<number, string>>({});
  const [reviewLoadingById, setReviewLoadingById] = useState<Record<number, boolean>>({});
  const [reviewErrById, setReviewErrById] = useState<Record<number, string | null>>({});

  const [selectedFileById, setSelectedFileById] = useState<Record<number, File | null>>({});
  const [previewById, setPreviewById] = useState<Record<number, string>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activePickId, setActivePickId] = useState<number | null>(null);

  const loadTransactions = async () => {
    if (!token) return;
    setErr(null);
    try {
      const res = await api<{ items: Trx[] }>("/transactions/me", { token });
      setItems(res.items);
    } catch (e: any) {
      setErr(e.message || "Failed to load transactions.");
    }
  };

  const loadAttended = async () => {
    if (!token) return;
    setAttErr(null);
    setAttLoading(true);
    try {
      const res = await api<{ items: AttendedEvent[] }>("/transactions/me/attended", { token });
      setAttended(res.items);
    } catch (e: any) {
      setAttErr(e.message || "Failed to load attended events.");
    } finally {
      setAttLoading(false);
    }
  };

  const loadReferralSummary = async () => {
    if (!token) return;
    setReferralErr(null);
    setReferralLoading(true);
    try {
      const res = await api<ReferralSummary>("/auth/referral-summary", { token });
      setReferral(res);
    } catch (e: any) {
      setReferralErr(e.message || "Failed to load referral summary.");
    } finally {
      setReferralLoading(false);
    }
  };

  const loadCoupons = async () => {
    if (!token) return;
    setCouponErr(null);
    setCouponLoading(true);
    try {
      const res = await api<{ items: CouponItem[] }>("/auth/coupons", { token });
      setCoupons(res.items ?? []);
    } catch (e: any) {
      setCouponErr(e.message || "Failed to load vouchers.");
    } finally {
      setCouponLoading(false);
    }
  };

  const refreshAll = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await Promise.all([loadTransactions(), loadAttended(), loadReferralSummary(), loadCoupons()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (loading || !user || !token) return;
    if (user.role !== "CUSTOMER") return;
    refreshAll().catch((e: any) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token]);

  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const openFilePicker = (trxId: number) => {
    setActivePickId(trxId);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!activePickId) return;

    setSelectedFileById((prev) => ({ ...prev, [activePickId]: f }));
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewById((prev) => ({ ...prev, [activePickId]: url }));
    }
    e.target.value = "";
  };

  const uploadProof = async (trx: Trx) => {
    setErr(null);

    if (!token) {
      setErr("Kamu belum login.");
      return;
    }
    if (user?.role !== "CUSTOMER") {
      setErr("Akses ditolak. Hanya CUSTOMER yang bisa upload bukti pembayaran.");
      return;
    }
    if (trx.status !== "WAITING_FOR_PAYMENT") {
      setErr("Transaksi ini tidak sedang menunggu pembayaran.");
      return;
    }
    const dueAt = new Date(trx.paymentDueAt).getTime();
    if (!Number.isNaN(dueAt) && Date.now() > dueAt) {
      setErr("Waktu pembayaran sudah habis. Transaksi akan kadaluarsa.");
      return;
    }

    const file = selectedFileById[trx.id];
    if (!file) {
      setErr("Pilih file dulu.");
      return;
    }

    setUploadingId(trx.id);

    try {
      const up = await uploadToCloudinary(file, token, "event-platform/payment-proofs");

      await api(`/transactions/${trx.id}/payment-proof`, {
        method: "POST",
        token,
        body: { paymentProofUrl: up.secureUrl },
      });

      await loadTransactions();

      setSelectedFileById((prev) => ({ ...prev, [trx.id]: null }));
      setPreviewById((prev) => {
        const next = { ...prev };
        delete next[trx.id];
        return next;
      });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploadingId(null);
    }
  };

  const submitReview = async (eventId: number, endAt: string) => {
    if (!token) return;
    const now = Date.now();
    if (new Date(endAt).getTime() > now) {
      setReviewErrById((prev) => ({
        ...prev,
        [eventId]: "Review available after the event ends.",
      }));
      return;
    }

    const rating = reviewRatingById[eventId] ?? 5;
    const comment = reviewCommentById[eventId] ?? "";

    if (!rating || rating < 1 || rating > 5) {
      setReviewErrById((prev) => ({
        ...prev,
        [eventId]: "Rating must be 1-5.",
      }));
      return;
    }

    setReviewLoadingById((prev) => ({ ...prev, [eventId]: true }));
    setReviewErrById((prev) => ({ ...prev, [eventId]: null }));

    try {
      await api(`/events/${eventId}/reviews`, {
        method: "POST",
        token,
        body: {
          rating,
          comment: comment.trim() ? comment.trim() : null,
        },
      });
      await loadAttended();
      setReviewOpenById((prev) => ({ ...prev, [eventId]: false }));
    } catch (e: any) {
      setReviewErrById((prev) => ({
        ...prev,
        [eventId]: e.message || "Failed to submit review.",
      }));
    } finally {
      setReviewLoadingById((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const copyReferralCode = async () => {
    if (!referral?.referralCode && !user?.referralCode) return;
    const code = referral?.referralCode ?? user?.referralCode ?? "";
    if (!code) return;

    try {
      if (!navigator?.clipboard) {
        setCopyMsg("Copy is not supported in this browser.");
        setTimeout(() => setCopyMsg(null), 1500);
        return;
      }
      await navigator.clipboard.writeText(code);
      setCopyMsg("Copied to clipboard.");
      setTimeout(() => setCopyMsg(null), 1500);
    } catch {
      setCopyMsg("Copy failed. Please copy manually.");
      setTimeout(() => setCopyMsg(null), 1500);
    }
  };

  const changePassword = async () => {
    if (!token) return;
    setPwErr(null);
    setPwOk(null);

    if (!currentPassword || !newPassword) {
      setPwErr("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPwErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr("Password confirmation does not match.");
      return;
    }

    setPwLoading(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        token,
        body: { currentPassword, newPassword },
      });
      setPwOk("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setPwErr(e.message || "Failed to update password.");
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-(--subtext)">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="ui-card p-6">
        <div className="text-xl font-semibold">Customer Dashboard</div>
        <div className="mt-2 text-sm text-(--subtext)">Login dulu untuk melihat dashboard.</div>
        <Link
          href="/login"
          className="inline-block mt-4 px-4 py-2 rounded-xl bg-(--primary)/25 hover:bg-(--primary)/35 border border-(--primary)/40 text-sm"
        >
          Login
        </Link>
      </div>
    );
  }

  if (user.role !== "CUSTOMER") {
    return (
      <div className="ui-card p-6">
        <div className="text-xl font-semibold">Customer Dashboard</div>
        <div className="mt-2 text-sm text-(--subtext)">Akun kamu adalah organizer.</div>
        <Link
          href="/organizer"
          className="inline-block mt-4 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
        >
          Go to organizer dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="ui-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Customer Dashboard</div>
            <div className="mt-1 text-sm text-(--subtext)">Transactions and reviews.</div>
          </div>

          <button
            onClick={refreshAll}
            disabled={refreshing || !token}
            className={`px-3 py-2 rounded-xl text-sm border ${
              refreshing || !token
                ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                : "bg-white/5 hover:bg-white/10 border-white/10"
            }`}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {err}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "transactions"} onClick={() => setTab("transactions")}>
          My Transactions
        </TabButton>
        <TabButton active={tab === "attended"} onClick={() => setTab("attended")}>
          Attended Events
        </TabButton>
        <TabButton active={tab === "account"} onClick={() => setTab("account")}>
          Account
        </TabButton>
      </div>

      {tab === "transactions" && (
        <div className="ui-card p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center">
              <div className="font-semibold">Belum ada transaksi</div>
              <div className="text-sm text-(--subtext) mt-1">Transaksi kamu akan muncul di sini.</div>
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map((t) => (
                <div key={t.id} className="ui-card p-5">
                  {(() => {
                    const dueMs = new Date(t.paymentDueAt).getTime();
                    const remainingSeconds =
                      t.status === "WAITING_FOR_PAYMENT" && !Number.isNaN(dueMs)
                        ? Math.max(0, Math.floor((dueMs - nowTs) / 1000))
                        : null;
                    const isExpired = remainingSeconds !== null && remainingSeconds <= 0;
                    const canUpload = t.status === "WAITING_FOR_PAYMENT" && !isExpired;

                    return (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.event.name}</div>
                      <div className="text-sm text-(--subtext) mt-1">
                        Trx #{t.id} • Qty {t.qty} • Total{" "}
                        <span className="text-white">{formatIDR(t.totalAmount)}</span>
                      </div>
                      <div className="text-xs text-(--subtext) mt-1">
                        Status: <span className="text-white">{t.status}</span>
                      </div>
                      {remainingSeconds !== null && (
                        <div
                          className={`text-xs mt-1 ${
                            isExpired ? "text-(--accent)" : "text-(--primary)"
                          }`}
                        >
                          {isExpired
                            ? "Waktu pembayaran habis"
                            : `Sisa waktu bayar: ${formatCountdown(remainingSeconds)}`}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      {t.paymentProofUrl ? (
                        <a
                          href={t.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                        >
                          View Proof
                        </a>
                      ) : (
                        <button
                          onClick={() => openFilePicker(t.id)}
                          disabled={!canUpload}
                          className={`inline-flex px-3 py-2 rounded-xl border text-sm ${
                            !canUpload
                              ? "bg-white/5 border-white/10 text-(--subtext) cursor-not-allowed"
                              : "bg-white/5 hover:bg-white/10 border-white/10"
                          }`}
                        >
                          {isExpired ? "Expired" : "Upload Proof"}
                        </button>
                      )}
                    </div>
                  </div>
                    );
                  })()}

                  {previewById[t.id] && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <img
                        src={previewById[t.id]}
                        alt="Preview"
                        className="h-24 w-32 rounded-lg object-cover border border-white/10"
                      />
                      <button
                        onClick={() => uploadProof(t)}
                        disabled={uploadingId === t.id}
                        className={`px-4 py-2 rounded-xl border text-sm ${
                          uploadingId === t.id
                            ? "bg-white/5 border-white/10 text-(--subtext) cursor-not-allowed"
                            : "bg-(--primary)/20 hover:bg-(--primary)/30 border-(--primary)/40"
                        }`}
                      >
                        {uploadingId === t.id ? "Uploading..." : "Submit Proof"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "attended" && (
        <div className="ui-card p-6">
          {attErr && (
            <div className="mb-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
              {attErr}
            </div>
          )}

          {attLoading ? (
            <div className="text-sm text-(--subtext)">Loading events...</div>
          ) : attended.length === 0 ? (
            <div className="text-center">
              <div className="font-semibold">Belum ada event yang selesai.</div>
              <div className="text-sm text-(--subtext) mt-1">
                Event yang sudah kamu hadiri akan muncul di sini.
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {attended.map((event) => (
                (() => {
                  const isEnded = new Date(event.endAt).getTime() <= Date.now();
                  const reviewOpen = Boolean(reviewOpenById[event.id]);
                  const rating = reviewRatingById[event.id] ?? 5;
                  const comment = reviewCommentById[event.id] ?? "";
                  const reviewErr = reviewErrById[event.id];
                  const reviewLoading = reviewLoadingById[event.id];

                  return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
                >
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="h-32 w-full bg-white/5 flex items-center justify-center text-xs text-(--subtext)">
                      No Image
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <Link href={`/events/${event.id}`} className="font-semibold hover:underline">
                      {event.name}
                    </Link>
                    <div className="text-xs text-(--subtext)">
                      {event.category} • {event.location}
                    </div>
                    <div className="text-xs text-(--subtext)">
                      {formatDateShort(event.startAt)} - {formatDateShort(event.endAt)}
                    </div>
                    <div className="text-xs text-(--subtext)">
                      Organizer:{" "}
                      <Link
                        href={`/organizers/${event.organizer.id}`}
                        className="text-white hover:underline"
                      >
                        {event.organizer.name}
                      </Link>
                    </div>

                    {event.myReview ? (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                        <div className="text-(--subtext)">Your review</div>
                        <div className="text-sm font-semibold text-white">
                          {event.myReview.rating}/5
                        </div>
                        {event.myReview.comment ? (
                          <div className="mt-1 text-(--subtext) whitespace-pre-line">
                            {event.myReview.comment}
                          </div>
                        ) : (
                          <div className="mt-1 text-(--subtext)">No comment.</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {!isEnded && (
                          <div className="text-xs text-(--subtext)">
                            Review available after the event ends.
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setReviewOpenById((prev) => ({
                              ...prev,
                              [event.id]: !reviewOpen,
                            }))
                          }
                          disabled={!isEnded}
                          className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs border ${
                            isEnded
                              ? "bg-(--primary)/20 hover:bg-(--primary)/30 border-(--primary)/40"
                              : "bg-white/5 border-white/10 text-(--subtext) cursor-not-allowed"
                          }`}
                        >
                          {reviewOpen ? "Close review" : "Write review"}
                        </button>

                        {reviewOpen && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs space-y-2">
                            <div>
                              <div className="text-(--subtext)">Rating</div>
                              <select
                                value={rating}
                                onChange={(e) =>
                                  setReviewRatingById((prev) => ({
                                    ...prev,
                                    [event.id]: Number(e.target.value),
                                  }))
                                }
                                className="ui-input ui-input-compact mt-1"
                              >
                                {[5, 4, 3, 2, 1].map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="text-(--subtext)">Comment (optional)</div>
                              <textarea
                                value={comment}
                                onChange={(e) =>
                                  setReviewCommentById((prev) => ({
                                    ...prev,
                                    [event.id]: e.target.value,
                                  }))
                                }
                                rows={3}
                                className="ui-input ui-input-compact mt-1"
                                placeholder="Share your experience..."
                              />
                            </div>
                            {reviewErr && (
                              <div className="text-(--accent) text-xs">{reviewErr}</div>
                            )}
                            <button
                              type="button"
                              onClick={() => submitReview(event.id, event.endAt)}
                              disabled={reviewLoading}
                              className={`w-full rounded-lg px-3 py-2 text-xs border ${
                                reviewLoading
                                  ? "bg-white/5 border-white/10 text-(--subtext) cursor-not-allowed"
                                  : "bg-(--primary)/20 hover:bg-(--primary)/30 border-(--primary)/40"
                              }`}
                            >
                              {reviewLoading ? "Submitting..." : "Submit review"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "account" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="ui-card p-6 space-y-3">
            <div>
              <div className="text-lg font-semibold">Referral</div>
              <div className="text-sm text-(--subtext) mt-1">
                Share your code to earn referral points.
              </div>
            </div>

            {referralErr && (
              <div className="rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
                {referralErr}
              </div>
            )}

            <div className="ui-panel p-4 space-y-2">
              <div className="text-xs text-(--subtext)">Your referral code</div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-semibold">
                  {referral?.referralCode ?? user.referralCode}
                </div>
                <button
                  type="button"
                  onClick={copyReferralCode}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs"
                >
                  Copy
                </button>
              </div>
              {copyMsg && <div className="text-xs text-emerald-200">{copyMsg}</div>}
            </div>

            <div className="ui-panel p-4">
              <div className="text-xs text-(--subtext)">Referral points earned</div>
              <div className="mt-1 text-xl font-semibold">
                {referralLoading ? "..." : referral?.referralPoints ?? 0}
              </div>
            </div>

            <div className="ui-panel p-4 space-y-2">
              <div className="text-xs text-(--subtext)">Your vouchers</div>
              {couponErr && <div className="text-(--accent) text-xs">{couponErr}</div>}
              {couponLoading ? (
                <div className="text-xs text-(--subtext)">Loading...</div>
              ) : coupons.length === 0 ? (
                <div className="text-xs text-(--subtext)">No active vouchers.</div>
              ) : (
                <div className="space-y-2 text-xs">
                  {coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div>
                        <div className="text-white">{coupon.code}</div>
                        <div className="text-(--subtext)">
                          Expires {new Date(coupon.expiresAt).toLocaleDateString("id-ID")}
                        </div>
                      </div>
                      <div className="font-semibold text-white">
                        {formatIDR(coupon.discountAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="ui-card p-6 space-y-3">
            <div>
              <div className="text-lg font-semibold">Change Password</div>
              <div className="text-sm text-(--subtext) mt-1">
                Update your password for this account.
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                type="password"
                className="ui-input"
              />
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                type="password"
                className="ui-input"
              />
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                type="password"
                className="ui-input"
              />
            </div>

            {pwErr && <div className="text-(--accent) text-sm">{pwErr}</div>}
            {pwOk && <div className="text-emerald-200 text-sm">{pwOk}</div>}

            <button
              type="button"
              onClick={changePassword}
              disabled={pwLoading}
              className={`w-full ui-btn ${
                pwLoading
                  ? "ui-btn-muted text-(--subtext) cursor-not-allowed"
                  : "ui-btn-primary"
              }`}
            >
              {pwLoading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
