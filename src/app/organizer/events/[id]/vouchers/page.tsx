"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, formatIDR } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Voucher = {
  id: number;
  code: string;
  discountAmount: number;
  startAt: string;
  endAt: string;
  maxUses: number | null;
  usedCount: number;
};

function toLocalInputValue(iso: string) {
  // ISO -> "YYYY-MM-DDTHH:mm" (local)
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function OrganizerVouchersPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const eventId = useMemo(() => {
    const raw = (params as any)?.id;
    const v = Array.isArray(raw) ? raw[0] : raw;
    return Number(v);
  }, [params]);

  const [items, setItems] = useState<Voucher[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [code, setCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState<number>(20000);
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState(""); // datetime-local
  const [maxUses, setMaxUses] = useState<string>(""); // "" => null

  // edit state
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [eCode, setECode] = useState("");
  const [eDiscountAmount, setEDiscountAmount] = useState<number>(0);
  const [eStartAt, setEStartAt] = useState("");
  const [eEndAt, setEEndAt] = useState("");
  const [eMaxUses, setEMaxUses] = useState<string>("");

  const load = async () => {
    if (!token) return;
    setErr(null);
    const res = await api<{ items: Voucher[] }>(`/events/${eventId}/vouchers`, { token });
    setItems(res.items ?? []);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) return router.push("/login");
    if (user.role !== "ORGANIZER") return router.push("/");
    if (!eventId) return;

    load().catch((e: any) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token, eventId]);

  const createVoucher = async () => {
    if (!token) return;

    setErr(null);

    const c = code.trim();
    if (!c) return setErr("Code wajib diisi");
    if (!startAt) return setErr("startAt wajib diisi");
    if (!endAt) return setErr("endAt wajib diisi");
    const s = new Date(startAt);
    const e = new Date(endAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return setErr("Tanggal tidak valid");
    if (e <= s) return setErr("endAt harus setelah startAt");
    if (discountAmount < 1) return setErr("discountAmount minimal 1");

    const mu = maxUses.trim() ? Number(maxUses) : null;
    if (mu !== null && (Number.isNaN(mu) || mu < 1)) return setErr("maxUses harus >= 1 atau kosong");

    const ok = window.confirm("Create voucher ini?");
    if (!ok) return;

    setBusy(true);
    try {
      await api(`/events/${eventId}/vouchers`, {
        method: "POST",
        token,
        body: {
          code: c,
          discountAmount: Number(discountAmount),
          startAt: s.toISOString(),
          endAt: e.toISOString(),
          maxUses: mu,
        },
      });

      setCode("");
      setMaxUses("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (v: Voucher) => {
    setEditing(v);
    setECode(v.code);
    setEDiscountAmount(v.discountAmount);
    setEStartAt(toLocalInputValue(v.startAt));
    setEEndAt(toLocalInputValue(v.endAt));
    setEMaxUses(v.maxUses === null ? "" : String(v.maxUses));
  };

  const saveEdit = async () => {
    if (!token || !editing) return;

    setErr(null);
    const c = eCode.trim();
    if (!c) return setErr("Code wajib diisi");
    if (!eStartAt) return setErr("startAt wajib diisi");
    if (!eEndAt) return setErr("endAt wajib diisi");
    const s = new Date(eStartAt);
    const e = new Date(eEndAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return setErr("Tanggal tidak valid");
    if (e <= s) return setErr("endAt harus setelah startAt");
    if (eDiscountAmount < 1) return setErr("discountAmount minimal 1");

    const mu = eMaxUses.trim() ? Number(eMaxUses) : null;
    if (mu !== null && (Number.isNaN(mu) || mu < 1)) return setErr("maxUses harus >= 1 atau kosong");

    const ok = window.confirm("Update voucher ini?");
    if (!ok) return;

    setBusy(true);
    try {
      await api(`/events/${eventId}/vouchers/${editing.id}`, {
        method: "PATCH",
        token,
        body: {
          code: c,
          discountAmount: Number(eDiscountAmount),
          startAt: s.toISOString(),
          endAt: e.toISOString(),
          maxUses: mu,
        },
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteVoucher = async (id: number) => {
    if (!token) return;
    setErr(null);

    const ok = window.confirm("Delete voucher ini? (Jika sudah usedCount > 0, akan ditolak)");
    if (!ok) return;

    setBusy(true);
    try {
      await api(`/events/${eventId}/vouchers/${id}`, { method: "DELETE", token });
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="ui-card p-6 text-sm text-(--subtext)">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="ui-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Manage Vouchers</div>
            <div className="mt-1 text-sm text-(--subtext)">
              Event #{eventId} • Create / Edit / Delete voucher.
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/organizer" className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
              Back
            </Link>
            <Link href={`/events/${eventId}`} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
              View Event
            </Link>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {err}
          </div>
        )}
      </div>

      {/* CREATE */}
      <div className="ui-card space-y-3">
        <div className="text-lg font-semibold">Create Voucher</div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Code</div>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="PROMO20"
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Discount Amount (IDR)</div>
            <input
              type="number"
              min={1}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Number(e.target.value))}
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Start At</div>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">End At</div>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3 md:col-span-2">
            <div className="text-xs text-(--subtext)">
              Voucher Quantity (per ticket, HARAP PERHATIKAN! kosong = unlimited )
            </div>
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder="15"
              className="ui-input mt-2"
            />
          </div>
        </div>

        <button
          disabled={busy}
          onClick={createVoucher}
          className={`w-full px-4 py-3 rounded-xl text-sm border ${
            busy
              ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
              : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
          }`}
        >
          {busy ? "Processing…" : "Create Voucher"}
        </button>
      </div>

      {/* LIST */}
      <div className="ui-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-lg font-semibold">Vouchers</div>
          <div className="text-sm text-(--subtext) mt-1">
            
          </div>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-sm text-(--subtext)">Belum ada voucher.</div>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs text-(--subtext) border-b border-white/10">
              <div className="col-span-3">Code</div>
              <div className="col-span-2">Discount</div>
              <div className="col-span-3">Period</div>
              <div className="col-span-2">Uses (tickets)</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {items.map((v) => (
              <div key={v.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-sm">
                <div className="col-span-3 font-semibold">{v.code}</div>
                <div className="col-span-2">{formatIDR(v.discountAmount)}</div>
                <div className="col-span-3 text-xs text-(--subtext)">
                  <div>{new Date(v.startAt).toLocaleString("id-ID")}</div>
                  <div>{new Date(v.endAt).toLocaleString("id-ID")}</div>
                </div>
                <div className="col-span-2 text-xs text-(--subtext)">
                  {v.usedCount}/{v.maxUses ?? "∞"}
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <button
                    onClick={() => openEdit(v)}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteVoucher(v.id)}
                    className="px-3 py-2 rounded-lg bg-(--accent)/20 hover:bg-(--accent)/30 border border-(--accent)/40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* EDIT MODAL SIMPLE */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl ui-card p-6 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Edit Voucher</div>
                <div className="text-sm text-(--subtext)">Voucher #{editing.id}</div>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="ui-panel p-3">
                <div className="text-xs text-(--subtext)">Code</div>
                <input
                  value={eCode}
                  onChange={(e) => setECode(e.target.value)}
                  className="ui-input mt-2"
                />
              </div>

              <div className="ui-panel p-3">
                <div className="text-xs text-(--subtext)">Discount Amount (IDR)</div>
                <input
                  type="number"
                  min={1}
                  value={eDiscountAmount}
                  onChange={(e) => setEDiscountAmount(Number(e.target.value))}
                  className="ui-input mt-2"
                />
              </div>

              <div className="ui-panel p-3">
                <div className="text-xs text-(--subtext)">Start At</div>
                <input
                  type="datetime-local"
                  value={eStartAt}
                  onChange={(e) => setEStartAt(e.target.value)}
                  className="ui-input mt-2"
                />
              </div>

              <div className="ui-panel p-3">
                <div className="text-xs text-(--subtext)">End At</div>
                <input
                  type="datetime-local"
                  value={eEndAt}
                  onChange={(e) => setEEndAt(e.target.value)}
                  className="ui-input mt-2"
                />
              </div>

              <div className="ui-panel p-3 md:col-span-2">
                <div className="text-xs text-(--subtext)">
                  Voucher Quantity (per ticket, kosong = unlimited)
                </div>
                <input
                  value={eMaxUses}
                  onChange={(e) => setEMaxUses(e.target.value)}
                  className="ui-input mt-2"
                />
              </div>
            </div>

            <button
              disabled={busy}
              onClick={saveEdit}
              className={`w-full px-4 py-3 rounded-xl text-sm border ${
                busy
                  ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                  : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
              }`}
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
