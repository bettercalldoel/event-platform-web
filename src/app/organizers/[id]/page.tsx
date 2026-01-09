"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, formatIDR } from "@/lib/api";

type Organizer = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
  createdAt: string;
};

type ReviewItem = {
  id: number;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user: { id: number; name: string };
  event: { id: number; name: string };
};

type OrganizerDetail = {
  organizer: Organizer;
  summary: { avgRating: number | null; totalReviews: number };
  events: {
    id: number;
    name: string;
    category: string;
    location: string;
    startAt: string;
    endAt: string;
    price: number;
    remainingSeats: number;
    imageUrl?: string | null;
    avgRating: number | null;
    totalReviews: number;
  }[];
  reviews: ReviewItem[];
};

function formatDateID(dateISO: string) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleString("id-ID");
}

function formatDateShort(dateISO: string) {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OrganizerProfilePage() {
  const params = useParams();
  const id = useMemo(() => {
    const raw = (params as any)?.id;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }, [params]);

  const [data, setData] = useState<OrganizerDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setErr(null);

    api<OrganizerDetail>(`/organizers/${id}`)
      .then(setData)
      .catch((e: any) => setErr(e.message || "Failed to load organizer"))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm">
        Invalid organizer id
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
        Loading organizer…
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
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm">
        Organizer not found
      </div>
    );
  }

  const { organizer, summary, reviews, events } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-white/10 overflow-hidden flex items-center justify-center">
              {organizer.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={organizer.avatarUrl}
                  alt={organizer.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-xs text-(--subtext)">No Avatar</div>
              )}
            </div>

            <div>
              <div className="text-2xl font-semibold">{organizer.name}</div>
              <div className="text-sm text-(--subtext)">{organizer.email}</div>
              <div className="text-xs text-(--subtext) mt-1">
                Joined: {formatDateID(organizer.createdAt)}
              </div>
            </div>
          </div>

          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
          >
            Back
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-(--subtext)">Avg Rating</div>
            <div className="mt-1 text-xl font-semibold">
              {summary.avgRating === null ? "-" : summary.avgRating.toFixed(1)}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-(--subtext)">Total Reviews</div>
            <div className="mt-1 text-xl font-semibold">{summary.totalReviews}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-(--subtext)">Role</div>
            <div className="mt-1 text-xl font-semibold">{organizer.role}</div>
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <div className="text-lg font-semibold">Events by {organizer.name}</div>
          <div className="text-sm text-(--subtext)">
            {events.length} event{events.length === 1 ? "" : "s"} published
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-6 text-sm text-(--subtext)">Belum ada event.</div>
        ) : (
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition hover:border-white/20"
              >
                {event.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.imageUrl}
                    alt={event.name}
                    className="h-32 w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-32 w-full bg-white/5 flex items-center justify-center text-xs text-(--subtext)">
                    No Image
                  </div>
                )}

                <div className="p-4 space-y-2">
                  <div className="font-semibold">{event.name}</div>
                  <div className="text-xs text-(--subtext)">
                    {event.category} • {event.location}
                  </div>
                  <div className="text-xs text-(--subtext)">
                    {formatDateShort(event.startAt)}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-white">
                      {event.price === 0 ? "Free" : formatIDR(event.price)}
                    </div>
                    <div className="text-(--subtext)">
                      {event.avgRating === null
                        ? "No ratings"
                        : `${event.avgRating.toFixed(1)} (${event.totalReviews})`}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="rounded-2xl border border-white/10 bg-(--surface) overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <div className="text-lg font-semibold">Reviews</div>
          <div className="text-sm text-(--subtext)">
            Review untuk event yang dibuat organizer ini.
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="p-6 text-sm text-(--subtext)">Belum ada review.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {reviews.map((r) => (
              <div key={r.id} className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {r.user.name} • <span className="text-(--subtext)">{r.rating}/5</span>
                    </div>
                    <div className="text-xs text-(--subtext) mt-1">
                      {formatDateID(r.createdAt)}
                    </div>
                  </div>

                  <Link
                    href={`/events/${r.event.id}`}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
                  >
                    View Event
                  </Link>
                </div>

                {r.comment ? (
                  <div className="mt-3 text-sm text-(--text)/90 whitespace-pre-line">
                    {r.comment}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-(--subtext)">No comment.</div>
                )}

                <div className="mt-3 text-xs text-(--subtext)">
                  Event: <b className="text-white">{r.event.name}</b>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
