"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, formatIDR } from "@/lib/api";

type EventItem = {
  id: number;
  name: string;
  category: string;
  location: string;
  startAt: string;
  endAt: string;
  price: number;
  remainingSeats: number;
  imageUrl?: string | null;
  organizer: { id: number; name: string };
};

type ListResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: EventItem[];
};

function useDebouncedValue<T>(value: T, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function HomePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const dq = useDebouncedValue(q, 450);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (dq.trim()) p.set("q", dq.trim());
    if (category.trim()) p.set("category", category.trim());
    if (location.trim()) p.set("location", location.trim());
    return p.toString();
  }, [dq, category, location]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api<ListResponse>(`/events${queryString ? `?${queryString}` : ""}`);
        setData(res);
      } catch (e: any) {
        setErr(e.message || "Failed to load events");
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [queryString]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-2xl font-semibold">
              <span className="text-(--primary)">Aqua</span>Event
            </div>
            <div className="mt-1 text-sm text-(--subtext)">
              Browse event, checkout, upload proof, organizer manage transactions.
            </div>
          </div>

          <div className="text-xs text-(--subtext)">
            {data ? (
              <>
                Showing <span className="text-white">{data.items.length}</span> of{" "}
                <span className="text-white">{data.total}</span> events
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Search (debounce)</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama / deskripsi…"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Category</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Tech, Music, Sport…"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Location</div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jakarta, Bandung…"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {err}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
          Loading events…
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-(--surface) p-8 text-center">
          <div className="text-lg font-semibold">Tidak ada event</div>
          <div className="mt-1 text-sm text-(--subtext)">
            Coba ubah filter/search atau buat event baru sebagai organizer.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="group rounded-2xl border border-white/10 bg-(--surface) overflow-hidden hover:border-white/20 transition"
            >
              {e.imageUrl ? (
                <img
                  src={e.imageUrl}
                  alt={e.name}
                  className="h-44 w-full object-cover border-b border-white/10"
                  loading="lazy"
                />
              ) : (
                <div className="h-44 w-full border-b border-white/10 bg-white/5 flex items-center justify-center text-xs text-(--subtext)">
                  No image
                </div>
              )}

              <div className="p-5 space-y-3">
                <div>
                  <div className="font-semibold text-base group-hover:text-(--primary) transition">
                    {e.name}
                  </div>
                  <div className="mt-1 text-xs text-(--subtext)">
                    {e.category} • {e.location}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-(--subtext)">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div>Start</div>
                    <div className="mt-1 text-white/90">
                      {new Date(e.startAt).toLocaleString("id-ID")}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div>Seats</div>
                    <div className="mt-1 text-white/90">{e.remainingSeats} left</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-(--subtext)">Price</div>
                    <div className="font-semibold">
                      {e.price === 0 ? "Free" : formatIDR(e.price)}
                    </div>
                  </div>
                  <div className="text-xs text-(--subtext)">
                    by <span className="text-white/90">{e.organizer?.name}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
