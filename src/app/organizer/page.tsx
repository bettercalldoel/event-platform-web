"use client";

import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Trx = {
  id: number;
  status: string;
  qty: number;
  totalAmount: number;
  paymentProofUrl?: string | null;
  customer: { id: number; name: string; email: string };
  event: { id: number; name: string; startAt?: string };
};

type OrgEvent = {
  id: number;
  name: string;
  category?: string;
  location?: string;
  startAt: string;
  endAt: string;
  price: number;
  remainingSeats: number;
  totalSeats: number;
  isPublished: boolean;
  imageUrl?: string | null; // ✅
};

type MainTab = "transactions" | "events";
type TrxTab = "pending" | "accepted" | "rejected" | "other";
type EventSort = "NAME_ASC" | "NAME_DESC" | "DATE_ASC" | "DATE_DESC";

function sortByEventName(items: Trx[]) {
  return [...items].sort((a, b) => {
    const an = (a.event?.name ?? "").trim();
    const bn = (b.event?.name ?? "").trim();
    const cmp = an.localeCompare(bn, "id", { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return a.id - b.id;
  });
}

function sortEvents(items: OrgEvent[], sort: EventSort) {
  const arr = [...items];
  if (sort === "NAME_ASC")
    arr.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  if (sort === "NAME_DESC")
    arr.sort((a, b) => b.name.localeCompare(a.name, "id", { sensitivity: "base" }));
  if (sort === "DATE_ASC")
    arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  if (sort === "DATE_DESC")
    arr.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  return arr;
}

export default function OrganizerPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  // ✅ fallback: kalau token dari useAuth belum kebaca, ambil dari localStorage
  const authToken =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const [mainTab, setMainTab] = useState<MainTab>("transactions");
  const [trxTab, setTrxTab] = useState<TrxTab>("pending");
  const [eventSort, setEventSort] = useState<EventSort>("DATE_ASC");

  const [trxItems, setTrxItems] = useState<Trx[]>([]);
  const [events, setEvents] = useState<OrgEvent[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTransactions = async () => {
    if (!authToken) return;
    const res = await api<{ items: Trx[] }>("/organizer/transactions", { token: authToken });
    setTrxItems(res.items);
  };

  const loadEvents = async () => {
    if (!authToken) return;
    const res = await api<{ items: OrgEvent[] }>(`/organizer/events?sort=${eventSort}`, {
      token: authToken,
    });
    setEvents(res.items);
  };

  const refreshAll = async () => {
    if (!authToken) return;
    setBusy(true);
    setErr(null);
    try {
      await Promise.all([loadTransactions(), loadEvents()]);
    } catch (e: any) {
      setErr(e.message || "Failed to load organizer data");
    } finally {
      setBusy(false);
    }
  };

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
      return;
    }

    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, authToken, eventSort]);

  const grouped = useMemo(() => {
    const pending = trxItems.filter((t) => t.status === "WAITING_FOR_ADMIN_CONFIRMATION");
    const accepted = trxItems.filter((t) => t.status === "DONE");
    const rejected = trxItems.filter((t) => t.status === "REJECTED");
    const other = trxItems.filter(
      (t) => !["WAITING_FOR_ADMIN_CONFIRMATION", "DONE", "REJECTED"].includes(t.status)
    );

    return {
      pending: sortByEventName(pending),
      accepted: sortByEventName(accepted),
      rejected: sortByEventName(rejected),
      other: sortByEventName(other),
      counts: {
        pending: pending.length,
        accepted: accepted.length,
        rejected: rejected.length,
        other: other.length,
      },
    };
  }, [trxItems]);

  const visibleTrx = useMemo(() => {
    if (trxTab === "pending") return grouped.pending;
    if (trxTab === "accepted") return grouped.accepted;
    if (trxTab === "rejected") return grouped.rejected;
    return grouped.other;
  }, [trxTab, grouped]);

  const visibleEvents = useMemo(() => sortEvents(events, eventSort), [events, eventSort]);

  const accept = async (id: number) => {
    if (!authToken) return;
    await api(`/transactions/${id}/accept`, { method: "PATCH", token: authToken });
    await loadTransactions();
  };

  const reject = async (id: number) => {
    if (!authToken) return;
    await api(`/transactions/${id}/reject`, { method: "PATCH", token: authToken });
    await loadTransactions();
  };

  const TabButton = ({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-xl text-sm border transition ${
        active ? "bg-(--primary)/25 border-(--primary)/40" : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  if (loading) return <div className="text-sm text-(--subtext)">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Organizer Dashboard</div>
            <div className="mt-1 text-sm text-(--subtext)">
              Transactions (pending/accepted/rejected) + My Events (sortable).
            </div>
          </div>

          <button
            onClick={refreshAll}
            disabled={busy || !authToken}
            className={`px-3 py-2 rounded-xl text-sm border ${
              busy || !authToken
                ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                : "bg-white/5 hover:bg-white/10 border-white/10"
            }`}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {err && <div className="mt-3 text-sm text-(--accent)">{err}</div>}
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={mainTab === "transactions"} onClick={() => setMainTab("transactions")}>
          Transactions
        </TabButton>
        <TabButton active={mainTab === "events"} onClick={() => setMainTab("events")}>
          My Events
        </TabButton>
      </div>

      {/* ================= TRANSACTIONS ================= */}
      {mainTab === "transactions" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <TabButton active={trxTab === "pending"} onClick={() => setTrxTab("pending")}>
              Pending ({grouped.counts.pending})
            </TabButton>
            <TabButton active={trxTab === "accepted"} onClick={() => setTrxTab("accepted")}>
              Accepted ({grouped.counts.accepted})
            </TabButton>
            <TabButton active={trxTab === "rejected"} onClick={() => setTrxTab("rejected")}>
              Rejected ({grouped.counts.rejected})
            </TabButton>
            <TabButton active={trxTab === "other"} onClick={() => setTrxTab("other")}>
              Other ({grouped.counts.other})
            </TabButton>
          </div>

          <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
            {visibleTrx.length === 0 ? (
              <div className="p-6 text-sm text-(--subtext)">Tidak ada transaksi di tab ini.</div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-(--subtext) border-b border-white/10">
                  <div className="col-span-3">Event</div>
                  <div className="col-span-3">Customer</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Total</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {visibleTrx.map((t) => (
                  <div key={t.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm">
                    <div className="col-span-3">
                      <div className="font-semibold">{t.event.name}</div>
                      <div className="text-xs text-(--subtext)">Trx #{t.id} • Qty {t.qty}</div>
                    </div>

                    <div className="col-span-3">
                      <div>{t.customer.name}</div>
                      <div className="text-xs text-(--subtext)">{t.customer.email}</div>
                    </div>

                    <div className="col-span-2">{t.status}</div>
                    <div className="col-span-2">{formatIDR(t.totalAmount)}</div>

                    <div className="col-span-2 flex justify-end gap-2">
                      {t.paymentProofUrl ? (
                        <a
                          href={t.paymentProofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                        >
                          View Proof
                        </a>
                      ) : (
                        <span className="px-3 py-2 text-xs text-(--subtext)">No proof</span>
                      )}

                      {trxTab === "pending" && (
                        <>
                          <ConfirmDialog
                            title="Reject transaction?"
                            description="Rollback seats/voucher/coupon/points."
                            confirmText="Reject"
                            onConfirm={() => reject(t.id)}
                            trigger={(open) => (
                              <button
                                onClick={open}
                                className="px-3 py-2 rounded-lg bg-(--accent)/20 hover:bg-(--accent)/30 border border-(--accent)/40"
                              >
                                Reject
                              </button>
                            )}
                          />
                          <ConfirmDialog
                            title="Accept transaction?"
                            description="Status menjadi DONE."
                            confirmText="Accept"
                            onConfirm={() => accept(t.id)}
                            trigger={(open) => (
                              <button
                                onClick={open}
                                className="px-3 py-2 rounded-lg bg-(--primary)/20 hover:bg-(--primary)/30 border border-(--primary)/40"
                              >
                                Accept
                              </button>
                            )}
                          />
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= EVENTS ================= */}
      {mainTab === "events" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">My Events</div>
                <div className="text-sm text-(--subtext) mt-1">Disortir sesuai pilihan.</div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm text-(--subtext)">Sort:</div>
                <select
                  value={eventSort}
                  onChange={(e) => setEventSort(e.target.value as EventSort)}
                  className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm outline-none"
                >
                  <option value="DATE_ASC">Tanggal (Terdekat)</option>
                  <option value="DATE_DESC">Tanggal (Terjauh)</option>
                  <option value="NAME_ASC">Nama (A–Z)</option>
                  <option value="NAME_DESC">Nama (Z–A)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
            {visibleEvents.length === 0 ? (
              <div className="p-6 text-sm text-(--subtext)">Belum ada event.</div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-(--subtext) border-b border-white/10">
                  <div className="col-span-5">Event</div>
                  <div className="col-span-3">Schedule</div>
                  <div className="col-span-2">Price</div>
                  <div className="col-span-2 text-right">Seats</div>
                </div>

                {visibleEvents.map((e) => (
                  <div
                    key={e.id}
                    className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm"
                  >
                    <div className="col-span-5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                          {e.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={e.imageUrl}
                              alt={e.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-[10px] text-(--subtext)">
                              No image
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold">{e.name}</div>
                          <div className="text-xs text-(--subtext)">
                            {e.category ?? "-"} • {e.location ?? "-"} •{" "}
                            {e.isPublished ? "Published" : "Hidden"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 text-xs text-(--subtext)">
                      <div>{new Date(e.startAt).toLocaleString("id-ID")}</div>
                      <div>{new Date(e.endAt).toLocaleString("id-ID")}</div>
                    </div>

                    <div className="col-span-2">{e.price === 0 ? "Free" : formatIDR(e.price)}</div>

                    <div className="col-span-2 text-right text-xs text-(--subtext)">
                      {e.remainingSeats}/{e.totalSeats}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
