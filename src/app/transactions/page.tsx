"use client";

import { useEffect, useRef, useState } from "react";
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
  paymentProofUrl?: string | null;
  event: { id: number; name: string };
};

export default function TransactionsPage() {
  const { user, token, loading } = useAuth();

  const [items, setItems] = useState<Trx[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // file per transaksi
  const [selectedFileById, setSelectedFileById] = useState<Record<number, File | null>>({});
  const [previewById, setPreviewById] = useState<Record<number, string>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  // kita pakai 1 input file, tapi tahu transaksi mana yang sedang memilih file
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activePickId, setActivePickId] = useState<number | null>(null);

  const load = async () => {
    if (!token) return;
    setErr(null);
    const res = await api<{ items: Trx[] }>("/transactions/me", { token });
    setItems(res.items);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) return; // UI akan handle below
    load().catch((e: any) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token]);

  const openFilePicker = (trxId: number) => {
    setActivePickId(trxId);
    // ini harus terjadi langsung dalam event click agar Chrome mau buka dialog file
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!activePickId) return;

    setSelectedFileById((prev) => ({ ...prev, [activePickId]: f }));

    // preview
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewById((prev) => ({ ...prev, [activePickId]: url }));
    }

    // reset value agar bisa pilih file yang sama lagi
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

    const file = selectedFileById[trx.id];
    if (!file) {
      setErr("Pilih file dulu.");
      return;
    }

    setUploadingId(trx.id);

    try {
      // 1) upload ke cloudinary
      const up = await uploadToCloudinary(file, token, "event-platform/payment-proofs");

      // 2) simpan URL proof ke backend
      // sesuaikan method dengan backend kamu: biasanya POST
      await api(`/transactions/${trx.id}/payment-proof`, {
        method: "POST",
        token,
        body: { paymentProofUrl: up.secureUrl },
      });

      // refresh
      await load();

      // clear local selected file
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

  if (loading) {
    return <div className="text-sm text-(--subtext)">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="text-xl font-semibold">My Transactions</div>
        <div className="mt-2 text-sm text-(--subtext)">Login dulu untuk melihat transaksi.</div>
        <Link
          href="/login"
          className="inline-block mt-4 px-4 py-2 rounded-xl bg-(--primary)/25 hover:bg-(--primary)/35 border border-(--primary)/40 text-sm"
        >
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">My Transactions</div>
            <div className="mt-1 text-sm text-(--subtext)">
              Upload bukti pembayaran hanya untuk status WAITING_FOR_PAYMENT.
            </div>
          </div>

          <button
            onClick={() => load()}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
          >
            Refresh
          </button>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {err}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="font-semibold">Belum ada transaksi</div>
          <div className="text-sm text-(--subtext) mt-1">Transaksi kamu akan muncul di sini.</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-(--surface) p-5">
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
                </div>

                <div className="text-right">
                  {t.paymentProofUrl ? (
                    <a
                      href={t.paymentProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                    >
                      View Proof
                    </a>
                  ) : (
                    <div className="text-xs text-(--subtext)">No proof yet</div>
                  )}
                </div>
              </div>

              {/* Upload section only if waiting for payment & paid */}
              {t.status === "WAITING_FOR_PAYMENT" && t.totalAmount > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Upload Payment Proof</div>
                  <div className="text-xs text-(--subtext) mt-1">
                    Deadline: {new Date(t.paymentDueAt).toLocaleString("id-ID")}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openFilePicker(t.id)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                    >
                      Choose File
                    </button>

                    <button
                      type="button"
                      disabled={uploadingId === t.id}
                      onClick={() => uploadProof(t)}
                      className={`px-3 py-2 rounded-xl text-sm border ${
                        uploadingId === t.id
                          ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                          : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
                      }`}
                    >
                      {uploadingId === t.id ? "Uploading…" : "Upload"}
                    </button>

                    {selectedFileById[t.id] && (
                      <div className="text-xs text-(--subtext)">
                        Selected: {selectedFileById[t.id]?.name}
                      </div>
                    )}
                  </div>

                  {previewById[t.id] && (
                    <div className="mt-3">
                      <img
                        src={previewById[t.id]}
                        alt="preview"
                        className="max-w-xs rounded-xl border border-white/10"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* For FREE transactions (total 0) */}
              {t.totalAmount === 0 && (
                <div className="mt-3 text-xs text-(--subtext)">
                  Ini transaksi free → tidak perlu upload bukti pembayaran.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
