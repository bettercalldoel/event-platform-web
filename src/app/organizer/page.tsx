"use client";

import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  imageUrl?: string | null;
};

type MainTab = "transactions" | "events" | "stats";
type TrxTab = "pending" | "accepted" | "rejected" | "other";
type EventSort = "NAME_ASC" | "NAME_DESC" | "DATE_ASC" | "DATE_DESC";
type EventFilter = "upcoming" | "past";
type StatsGroupBy = "day" | "month" | "year";

type StatsResponse = {
  range: StatsGroupBy;
  items: Array<{
    period: string;
    eventId: number;
    eventName: string;
    totalTickets: number;
    totalRevenue: number;
  }>;
};

type AttendeesResponse = {
  event: { id: number; name: string; startAt: string };
  summary: { totalAttendees: number; totalTickets: number; totalRevenue: number };
  items: Array<{
    id: number;
    qty: number;
    totalAmount: number;
    createdAt: string;
    customer: { id: number; name: string; email: string };
  }>;
};

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
  if (sort === "NAME_ASC") arr.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  if (sort === "NAME_DESC") arr.sort((a, b) => b.name.localeCompare(a.name, "id", { sensitivity: "base" }));
  if (sort === "DATE_ASC") arr.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  if (sort === "DATE_DESC") arr.sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  return arr;
}

function formatBucket(groupBy: StatsGroupBy, period: string) {
  const d = new Date(period);
  if (groupBy === "year") return String(d.getFullYear());
  if (groupBy === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  // day
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function OrganizerPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  const authToken =
    token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const [mainTab, setMainTab] = useState<MainTab>("transactions");
  const [trxTab, setTrxTab] = useState<TrxTab>("pending");
  const [eventSort, setEventSort] = useState<EventSort>("DATE_ASC");
  const [eventFilter, setEventFilter] = useState<EventFilter>("upcoming");

  const [trxItems, setTrxItems] = useState<Trx[]>([]);
  const [events, setEvents] = useState<OrgEvent[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ===== Stats state =====
  const [statsGroupBy, setStatsGroupBy] = useState<StatsGroupBy>("day");
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  // ===== Attendees modal =====
  const [attOpen, setAttOpen] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [attErr, setAttErr] = useState<string | null>(null);
  const [attData, setAttData] = useState<AttendeesResponse | null>(null);

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

  const loadStats = async () => {
    if (!authToken) return;
    setStatsLoading(true);
    setStatsErr(null);

    try {
      const params = new URLSearchParams();
      params.set("range", statsGroupBy);

      const res = await api<StatsResponse>(`/organizer/stats?${params.toString()}`, { token: authToken });
      setStats(res);
    } catch (e: any) {
      setStatsErr(e.message || "Failed to load stats");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const openAttendees = async (eventId: number) => {
    if (!authToken) return;
    setAttOpen(true);
    setAttLoading(true);
    setAttErr(null);
    setAttData(null);

    try {
      const res = await api<AttendeesResponse>(`/organizer/events/${eventId}/attendees`, { token: authToken });
      setAttData(res);
    } catch (e: any) {
      setAttErr(e.message || "Failed to load attendees");
    } finally {
      setAttLoading(false);
    }
  };

  const refreshAll = async () => {
    if (!authToken) return;
    setBusy(true);
    setErr(null);
    try {
      await Promise.all([loadTransactions(), loadEvents()]);
      if (mainTab === "stats") await loadStats();
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

    // load base data
    Promise.all([loadTransactions(), loadEvents()]).catch((e: any) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, authToken, eventSort]);

  // load stats when tab is opened or inputs change
  useEffect(() => {
    if (!authToken) return;
    if (mainTab !== "stats") return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, statsGroupBy, authToken]);

  const grouped = useMemo(() => {
    const pending = trxItems.filter((t) => t.status === "WAITING_FOR_ADMIN_CONFIRMATION");
    const accepted = trxItems.filter((t) => t.status === "DONE");
    const rejected = trxItems.filter((t) => t.status === "REJECTED");
    const other = trxItems.filter((t) => !["WAITING_FOR_ADMIN_CONFIRMATION", "DONE", "REJECTED"].includes(t.status));

    return {
      pending: sortByEventName(pending),
      accepted: sortByEventName(accepted),
      rejected: sortByEventName(rejected),
      other: sortByEventName(other),
      counts: { pending: pending.length, accepted: accepted.length, rejected: rejected.length, other: other.length },
    };
  }, [trxItems]);

  const visibleTrx = useMemo(() => {
    if (trxTab === "pending") return grouped.pending;
    if (trxTab === "accepted") return grouped.accepted;
    if (trxTab === "rejected") return grouped.rejected;
    return grouped.other;
  }, [trxTab, grouped]);

  const visibleEvents = useMemo(() => {
    const now = Date.now();
    const sorted = sortEvents(events, eventSort);
    if (eventFilter === "past") {
      return sorted.filter((event) => new Date(event.endAt).getTime() < now);
    }
    return sorted.filter((event) => new Date(event.endAt).getTime() >= now);
  }, [events, eventSort, eventFilter]);

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
        active
          ? "bg-(--primary)/25 border-(--primary)/40"
          : "bg-white/5 border-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );

  const statsSummary = useMemo(() => {
    const items = stats?.items ?? [];
    const totals = items.reduce(
      (acc, item) => {
        acc.totalTickets += item.totalTickets || 0;
        acc.totalRevenue += item.totalRevenue || 0;
        acc.events.add(item.eventId);
        return acc;
      },
      { totalTickets: 0, totalRevenue: 0, events: new Set<number>() }
    );

    return {
      totalTickets: totals.totalTickets,
      totalRevenue: totals.totalRevenue,
      totalEvents: totals.events.size,
    };
  }, [stats]);

  const ticketSummary = useMemo(() => {
    return events.reduce(
      (acc, event) => {
        const total = event.totalSeats || 0;
        const remaining = event.remainingSeats || 0;
        acc.totalSeats += total;
        acc.remainingSeats += remaining;
        return acc;
      },
      { totalSeats: 0, remainingSeats: 0 }
    );
  }, [events]);

  const ticketsSold = Math.max(0, ticketSummary.totalSeats - ticketSummary.remainingSeats);

  if (loading) return <div className="text-sm text-(--subtext)">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Dashboard</div>
            <div className="mt-1 text-sm text-(--subtext)">Manage events, sales, and stats.</div>
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

      {/* Main tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton active={mainTab === "transactions"} onClick={() => setMainTab("transactions")}>
          Transactions
        </TabButton>
        <TabButton active={mainTab === "events"} onClick={() => setMainTab("events")}>
          My Events
        </TabButton>
        <TabButton active={mainTab === "stats"} onClick={() => setMainTab("stats")}>
          Stats
        </TabButton>
      </div>

      {/* TRANSACTIONS */}
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

      {/* EVENTS */}
      {mainTab === "events" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">My Events</div>
                  <div className="text-sm text-(--subtext) mt-1">Filter upcoming or past events.</div>
                </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm text-(--subtext)">Filter:</div>
                <div className="flex items-center gap-2">
                  <TabButton
                    active={eventFilter === "upcoming"}
                    onClick={() => setEventFilter("upcoming")}
                  >
                    Upcoming
                  </TabButton>
                  <TabButton
                    active={eventFilter === "past"}
                    onClick={() => setEventFilter("past")}
                  >
                    Past
                  </TabButton>
                </div>
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
                  <div className="col-span-2 text-right">Actions</div>
                </div>

                {visibleEvents.map((e) => (
                  <div key={e.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm">
                    <div className="col-span-5">
                      <div className="flex items-center gap-3">
                        {e.imageUrl ? (
                          <img
                            src={e.imageUrl}
                            alt={e.name}
                            className="h-10 w-14 rounded-lg object-cover border border-white/10"
                          />
                        ) : (
                          <div className="h-10 w-14 rounded-lg bg-white/5 border border-white/10 text-[10px] text-(--subtext) flex items-center justify-center">
                            No Image
                          </div>
                        )}

                        <div>
                          <div className="font-semibold">{e.name}</div>
                          <div className="text-xs text-(--subtext)">
                            {e.category ?? "-"} • {e.location ?? "-"} •{" "}
                            {e.isPublished ? "Published" : "Hidden"} • Seats {e.remainingSeats}/{e.totalSeats}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 text-xs text-(--subtext)">
                      <div>{new Date(e.startAt).toLocaleString("id-ID")}</div>
                      <div>{new Date(e.endAt).toLocaleString("id-ID")}</div>
                    </div>

                    <div className="col-span-2">{e.price === 0 ? "Free" : formatIDR(e.price)}</div>

                    <div className="col-span-2 flex justify-end gap-2">
                      <Link
                        href={`/organizer/events/${e.id}/vouchers`}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                      >
                        Vouchers
                      </Link>
                      <button
                        onClick={() => openAttendees(e.id)}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                      >
                        Attendees
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      {mainTab === "stats" && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Statistics</div>
                <div className="text-sm text-(--subtext) mt-1">Summary of DONE sales.</div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statsGroupBy}
                  onChange={(e) => setStatsGroupBy(e.target.value as StatsGroupBy)}
                  className="rounded-xl bg-(--muted) border border-white/10 px-3 py-2 text-sm outline-none"
                >
                  <option value="day">Day</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
                <button
                  onClick={loadStats}
                  disabled={statsLoading || !authToken}
                  className={`px-3 py-2 rounded-xl text-sm border ${
                    statsLoading || !authToken
                      ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                      : "bg-white/5 hover:bg-white/10 border-white/10"
                  }`}
                >
                  {statsLoading ? "Loading…" : "Reload"}
                </button>
              </div>
            </div>

            {statsErr && (
              <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
                {statsErr}
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
              <div className="text-xs text-(--subtext)">Events with sales</div>
              <div className="mt-1 text-2xl font-semibold">{statsSummary.totalEvents}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
              <div className="text-xs text-(--subtext)">Tickets sold</div>
              <div className="mt-1 text-2xl font-semibold">{ticketsSold}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
              <div className="text-xs text-(--subtext)">Tickets available</div>
              <div className="mt-1 text-2xl font-semibold">
                {ticketSummary.remainingSeats}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-(--surface) p-5">
              <div className="text-xs text-(--subtext)">Total revenue</div>
              <div className="mt-1 text-2xl font-semibold">
                {formatIDR(statsSummary.totalRevenue)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-(--subtext) border-b border-white/10">
              <div className="col-span-3">Period</div>
              <div className="col-span-5">Event</div>
              <div className="col-span-2 text-right">Tickets</div>
              <div className="col-span-2 text-right">Revenue</div>
            </div>

            {statsLoading ? (
              <div className="p-4 text-sm text-(--subtext)">Loading…</div>
            ) : !stats || stats.items.length === 0 ? (
              <div className="p-4 text-sm text-(--subtext)">No data yet.</div>
            ) : (
              stats.items.map((item, idx) => (
                <div
                  key={`${item.eventId}-${idx}`}
                  className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm"
                >
                  <div className="col-span-3 text-(--subtext)">
                    {formatBucket(statsGroupBy, item.period)}
                  </div>
                  <div className="col-span-5">{item.eventName}</div>
                  <div className="col-span-2 text-right">{item.totalTickets}</div>
                  <div className="col-span-2 text-right">{formatIDR(item.totalRevenue)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ATTENDEES MODAL */}
      {attOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">Attendees</div>
                <div className="text-sm text-(--subtext) mt-1">
                  {attData?.event ? (
                    <>
                      {attData.event.name} • {new Date(attData.event.startAt).toLocaleString("id-ID")}
                    </>
                  ) : (
                    "Loading…"
                  )}
                </div>
              </div>

              <button
                onClick={() => setAttOpen(false)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              {attLoading ? (
                <div className="text-sm text-(--subtext)">Loading attendees…</div>
              ) : attErr ? (
                <div className="rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">{attErr}</div>
              ) : !attData ? (
                <div className="text-sm text-(--subtext)">No data</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-(--subtext)">Total Attendees (rows)</div>
                      <div className="mt-1 text-xl font-semibold">{attData.summary.totalAttendees}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-(--subtext)">Total Tickets</div>
                      <div className="mt-1 text-xl font-semibold">{attData.summary.totalTickets}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-(--subtext)">Total Revenue</div>
                      <div className="mt-1 text-xl font-semibold">{formatIDR(attData.summary.totalRevenue)}</div>
                    </div>
                  </div>

                  {attData.items.length === 0 ? (
                    <div className="text-sm text-(--subtext)">Belum ada attendee (DONE).</div>
                  ) : (
                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-(--subtext) border-b border-white/10 bg-white/5">
                        <div className="col-span-5">Customer</div>
                        <div className="col-span-2">Qty</div>
                        <div className="col-span-3">Total Paid</div>
                        <div className="col-span-2 text-right">Time</div>
                      </div>

                      {attData.items.map((it) => (
                        <div key={it.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm">
                          <div className="col-span-5">
                            <div className="font-semibold">{it.customer.name}</div>
                            <div className="text-xs text-(--subtext)">{it.customer.email}</div>
                          </div>
                          <div className="col-span-2">{it.qty}</div>
                          <div className="col-span-3">{formatIDR(it.totalAmount)}</div>
                          <div className="col-span-2 text-right text-xs text-(--subtext)">
                            {new Date(it.createdAt).toLocaleString("id-ID")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
