"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function useDebounce<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function HomePage() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const dq = useDebounce(q, 400);

  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (dq.trim()) params.set("q", dq.trim());
    if (category.trim()) params.set("category", category.trim());
    if (location.trim()) params.set("location", location.trim());
    return params.toString();
  }, [dq, category, location]);

  useEffect(() => {
    setLoading(true);
    setErr(null);

    api<{ items: EventItem[] }>(`/events?${queryString}`)
      .then((res: any) => setItems(res.items ?? []))
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [queryString]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="text-2xl font-semibold">Discover Events</div>
        <div className="mt-1 text-sm text-(--subtext)">
          Cari event, filter kategori & lokasi. (Search pakai debounce)
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search (name/description)…"
            className="rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. Tech)"
            className="rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (e.g. Jakarta)"
            className="rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
          />
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-(--accent)/40 bg-(--accent)/10 p-4 text-sm">
          {err}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-(--subtext)">Loading events…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-(--surface) p-8 text-center">
          <div className="text-lg font-semibold">Tidak ada event</div>
          <div className="mt-1 text-sm text-(--subtext)">
            Coba ubah filter atau keyword search.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/events/${e.id}`)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") router.push(`/events/${e.id}`);
              }}
              className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden hover:border-white/20 transition cursor-pointer"
            >
              {/* IMAGE */}
              {e.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt={e.name} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-white/5 flex items-center justify-center text-xs text-(--subtext)">
                  No Image
                </div>
              )}

              <div className="p-4 space-y-2">
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-(--subtext)">
                  {e.category} • {e.location}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">
                    {e.price === 0 ? "Free" : formatIDR(e.price)}
                  </div>
                  <div className="text-xs text-(--subtext)">
                    Seats: {e.remainingSeats}
                  </div>
                </div>

                {/* ✅ LINK ORGANIZER (stop click bubble biar gak ke event detail) */}
                <div className="text-xs text-(--subtext)">
                  By{" "}
                  <Link
                    href={`/organizers/${e.organizer.id}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-(--primary) hover:underline"
                  >
                    {e.organizer?.name ?? "Organizer"}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
