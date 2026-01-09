"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type OrganizerResponse = {
  organizer: { id: number; name: string; email: string; avatarUrl: string | null; role: string; createdAt: string };
  summary: { avgRating: number | null; totalReviews: number };
  reviews: {
    id: number;
    rating: number;
    comment: string | null;
    createdAt: string;
    user: { id: number; name: string };
    event: { id: number; name: string };
  }[];
};

export default function OrganizerProfilePage() {
  const params = useParams();

  const organizerId = useMemo(() => {
    const raw = (params as any)?.id;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }, [params]);

  const [data, setData] = useState<OrganizerResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizerId) {
      setLoading(false);
      setErr("Invalid organizer id");
      return;
    }

    setLoading(true);
    setErr(null);

    api<OrganizerResponse>(`/organizers/${organizerId}`)
      .then(setData)
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [organizerId]);

  if (loading) {
    return (
      <div className="ui-card p-6 text-sm text-(--subtext)">
        Loading organizer…
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-(--accent)/40 bg-(--accent)/10 p-4 text-sm">{err}</div>
        <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
          Back to events
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="ui-card p-6 text-sm">
        Organizer not found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="ui-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">{data.organizer.name}</div>
            <div className="text-sm text-(--subtext)">{data.organizer.email}</div>
          </div>
          <Link href="/" className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
            Browse Events
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Average Rating</div>
            <div className="mt-1 text-lg font-semibold">
              {data.summary.avgRating === null ? "-" : data.summary.avgRating.toFixed(1)}
            </div>
          </div>
          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Total Reviews</div>
            <div className="mt-1 text-lg font-semibold">{data.summary.totalReviews}</div>
          </div>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-lg font-semibold">Reviews</div>
        </div>

        {data.reviews.length === 0 ? (
          <div className="p-6 text-sm text-(--subtext)">Belum ada review.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {data.reviews.map((r) => (
              <div key={r.id} className="p-5">
                <div className="text-sm text-(--subtext)">
                  Event: <Link className="text-white hover:underline" href={`/events/${r.event.id}`}>{r.event.name}</Link>
                </div>
                <div className="mt-1 text-sm">
                  {r.rating}/5 • by <span className="text-white">{r.user.name}</span>
                </div>
                {r.comment && <div className="mt-2 text-sm text-(--text)/90">{r.comment}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
