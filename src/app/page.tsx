"use client";

import Link from "next/link";
import { Fragment, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, formatIDR } from "@/lib/api";
import { EVENT_CATEGORIES } from "@/lib/constants";

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

const DESKTOP_PAGE_SIZE = 6;
const MOBILE_PAGE_SIZE = 3;
const DESKTOP_PAST_LIMIT = 3;
const MOBILE_PAST_LIMIT = 3;

function useDebounce<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="ui-card p-6 text-sm text-(--subtext)">Loading…</div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = useMemo(() => searchParams.toString(), [searchParams]);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");

  const dq = useDebounce(q, 400);

  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pastItems, setPastItems] = useState<EventItem[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const [pastErr, setPastErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DESKTOP_PAGE_SIZE);
  const [pastLimit, setPastLimit] = useState(DESKTOP_PAST_LIMIT);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const baseQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (dq.trim()) params.set("q", dq.trim());
    if (category.trim()) params.set("category", category.trim());
    if (location.trim()) params.set("location", location.trim());
    return params.toString();
  }, [dq, category, location]);

  const upcomingQueryString = useMemo(() => {
    const params = new URLSearchParams(baseQueryString);
    params.set("time", "upcoming");
    params.set("page", String(page));
    params.set("limit", String(pageSize));
    return params.toString();
  }, [baseQueryString, page, pageSize]);

  const pastQueryString = useMemo(() => {
    const params = new URLSearchParams(baseQueryString);
    params.set("time", "past");
    params.set("page", "1");
    params.set("limit", String(pastLimit));
    return params.toString();
  }, [baseQueryString, pastLimit]);

  useEffect(() => {
    setLoading(true);
    setErr(null);

    api<{
      items: EventItem[];
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    }>(`/events?${upcomingQueryString}`)
      .then((res: any) => {
        setItems(res.items ?? []);
        setTotalItems(Number(res.total ?? res.items?.length ?? 0));
        setTotalPages(Math.max(1, Number(res.totalPages ?? 1)));
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoading(false));

    setPastLoading(true);
    setPastErr(null);
    api<{ items: EventItem[] }>(`/events?${pastQueryString}`)
      .then((res: any) => setPastItems(res.items ?? []))
      .catch((e: any) => setPastErr(e.message))
      .finally(() => setPastLoading(false));
  }, [upcomingQueryString, pastQueryString]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 768px)");
    const update = () => {
      const next = media.matches ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;
      const nextPast = media.matches ? MOBILE_PAST_LIMIT : DESKTOP_PAST_LIMIT;
      setPageSize(next);
      setPastLimit(nextPast);
      setPage(1);
    };
    update();
    if (media.addEventListener) {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const nextQ = params.get("q") ?? "";
    const rawCategory = params.get("category") ?? "";
    const nextCategory =
      rawCategory.trim().length === 0
        ? ""
        : EVENT_CATEGORIES.find(
            (item) => item.toLowerCase() === rawCategory.toLowerCase()
          ) ?? "";
    const nextLocation = params.get("location") ?? "";
    const pageRaw = Number(params.get("page") ?? "1");
    const nextPage = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

    setQ((prev) => (prev === nextQ ? prev : nextQ));
    setCategory((prev) => (prev === nextCategory ? prev : nextCategory));
    setLocation((prev) => (prev === nextLocation ? prev : nextLocation));
    setPage((prev) => (prev === nextPage ? prev : nextPage));
  }, [searchKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (category.trim()) params.set("category", category.trim());
    if (location.trim()) params.set("location", location.trim());
    if (page > 1) params.set("page", String(page));

    const next = params.toString();
    if (next !== searchKey) {
      router.replace(next ? `/?${next}` : "/", { scroll: false });
    }
  }, [q, category, location, page, router, searchKey]);

  const activeFilters = useMemo(() => {
    const filters: { label: string; value: string }[] = [];
    if (dq.trim()) filters.push({ label: "Search", value: dq.trim() });
    if (category.trim()) filters.push({ label: "Category", value: category.trim() });
    if (location.trim()) filters.push({ label: "Location", value: location.trim() });
    return filters;
  }, [dq, category, location]);

  const filterBadges = useMemo(() => {
    const badges: { label: string; value: string }[] = [];
    if (category.trim()) badges.push({ label: "Category", value: category.trim() });
    if (location.trim()) badges.push({ label: "Location", value: location.trim() });
    return badges;
  }, [category, location]);

  const seatsLeft = useMemo(
    () => items.reduce((sum, item) => sum + item.remainingSeats, 0),
    [items]
  );

  const featured = items[0];
  const cardDelay = (index: number): CSSProperties => ({
    animationDelay: `${index * 70}ms`,
  });
  const activeFilterCount = filterBadges.length;
  const hasAnyFilter = Boolean(q.trim() || category.trim() || location.trim());
  const resultsLabel = loading
    ? "Loading..."
    : totalItems === 1
      ? "1 result"
      : `${totalItems} results`;
  const pageButtons = useMemo(() => {
    if (totalPages <= 1) return [];
    const pages = new Set<number>();
    [1, totalPages, page, page - 1, page + 1].forEach((p) => {
      if (p >= 1 && p <= totalPages) pages.add(p);
    });
    return Array.from(pages).sort((a, b) => a - b);
  }, [page, totalPages]);

  const resetFilters = () => {
    setQ("");
    setCategory("");
    setLocation("");
    setPage(1);
  };

  const goToPage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
  };

  const renderEventCard = (event: EventItem, index: number) => (
    <div
      key={event.id}
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/events/${event.id}`)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter") router.push(`/events/${event.id}`);
      }}
      className="group animate-fade-up rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(15,23,42,0.7))] p-3 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.7)] transition hover:-translate-y-0.5 hover:border-white/20"
      style={cardDelay(index)}
    >
      <div className="relative overflow-hidden rounded-xl">
        <Link
          href={`/?category=${encodeURIComponent(event.category)}`}
          onClick={(ev) => ev.stopPropagation()}
          className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-1 text-[10px] uppercase tracking-widest text-white/70 transition hover:bg-black/60"
        >
          {event.category}
        </Link>
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt={event.name}
            className="h-32 w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center bg-white/5 text-xs text-white/60">
            No Image
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2">
        <div className="text-sm font-semibold leading-snug text-white">{event.name}</div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
          <span className="rounded-full bg-white/10 px-2 py-1">{event.location}</span>
          <span className="rounded-full bg-white/10 px-2 py-1">
            Seats {event.remainingSeats}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-white/70">
          <div className="text-sm font-semibold text-amber-200">
            {event.price === 0 ? "Free" : formatIDR(event.price)}
          </div>
          <div>
            By{" "}
            <Link
              href={`/organizers/${event.organizer.id}`}
              onClick={(ev) => ev.stopPropagation()}
              className="text-white/80 hover:text-white hover:underline"
            >
              {event.organizer?.name ?? "Organizer"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.35),transparent_45%),radial-gradient(circle_at_top_right,rgba(251,146,60,0.28),transparent_45%),linear-gradient(140deg,rgba(15,23,42,0.98),rgba(2,6,23,0.95))] p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.55),transparent_70%)] blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(251,113,133,0.5),transparent_70%)] blur-2xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4 animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/80">
              <span className="h-2 w-2 rounded-full bg-emerald-300"></span>
              Fresh events every week
            </div>
            <h1 className="font-display text-3xl leading-[1.05] text-white sm:text-4xl md:text-5xl">
              Discover moments that feel{" "}
              <span className="text-amber-200">worth the ride</span>
            </h1>
            <p className="max-w-lg text-sm text-white/70">
              Curate your weekend in minutes. Search by vibe, category, or city,
              then book before seats run out.
            </p>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-45 flex-1 items-center gap-2 rounded-2xl bg-black/20 px-3 py-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/60">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M15.5 15.5l4 4m-2-7a6 6 0 1 1-12 0 6 6 0 0 1 12 0z"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </span>
                  <input
                    value={q}
                    onChange={(e) => {
                      setQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search events, categories, or city"
                    aria-label="Search events"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowFilters((prev) => !prev)}
                    aria-expanded={showFilters}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white/80 transition hover:bg-white/20"
                  >
                    Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                  </button>
                  {hasAnyFilter && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="ui-panel px-3 py-2 text-xs text-white/60 transition hover:bg-white/15"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {showFilters && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs text-white/70">
                    <span className="text-[11px] uppercase tracking-widest">
                      Category
                    </span>
                    <select
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-amber-300/60"
                    >
                      <option value="">All categories</option>
                      {EVENT_CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-white/70">
                    <span className="text-[11px] uppercase tracking-widest">
                      Location
                    </span>
                    <input
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Jakarta, Bali"
                      className="w-full ui-panel px-3 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-sky-300/60"
                    />
                  </label>
                </div>
              )}

              {filterBadges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/70">
                  {category.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategory("");
                        setPage(1);
                      }}
                      className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 transition hover:bg-white/20"
                    >
                      Category: {category.trim()}
                      <span className="text-white/50">x</span>
                    </button>
                  )}
                  {location.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocation("");
                        setPage(1);
                      }}
                      className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 transition hover:bg-white/20"
                    >
                      Location: {location.trim()}
                      <span className="text-white/50">x</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-white/70">
              {EVENT_CATEGORIES.map((tag) => (
                <Link
                  key={tag}
                  href={`/?category=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-white/10 px-3 py-1 transition hover:bg-white/20"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4 animate-fade-up animate-delay-1">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-white/60">
                <span>Spotlight</span>
                <span className="rounded-full bg-amber-400/20 px-2 py-1 text-amber-100">
                  Trending
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#0b1220]/70 p-3">
                {featured ? (
                  <Link href={`/events/${featured.id}`} className="group block">
                    <div className="flex gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/10">
                        {featured.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={featured.imageUrl}
                            alt={featured.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-white/50">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-white transition group-hover:text-amber-200">
                          {featured.name}
                        </div>
                        <div className="text-xs text-white/60">
                          {featured.category} • {featured.location}
                        </div>
                        <div className="text-xs font-semibold text-amber-200">
                          {featured.price === 0 ? "Free" : formatIDR(featured.price)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : loading ? (
                  <div className="text-xs text-white/70">Loading spotlight...</div>
                ) : (
                  <div className="text-xs text-white/70">
                    No events yet. Try a new search.
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/70">
                <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                    Events live
                  </div>
                  <div className="font-display text-lg text-white">
                    {loading ? "..." : totalItems.toLocaleString("id-ID")}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                    Seats in view
                  </div>
                  <div className="font-display text-lg text-white">
                    {loading ? "..." : seatsLeft.toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
          {err}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-xl text-white sm:text-2xl">
              Upcoming events
            </div>
            <div className="text-xs text-(--subtext)">
              Find something for your calendar.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="rounded-full bg-white/10 px-3 py-1">
              {resultsLabel}
            </span>
            {activeFilters.length === 0 ? (
              <span className="rounded-full bg-white/10 px-3 py-1">All events</span>
            ) : (
              activeFilters.map((filter) => (
                <span
                  key={`${filter.label}-${filter.value}`}
                  className="rounded-full bg-white/10 px-3 py-1"
                >
                  {filter.label}: {filter.value}
                </span>
              ))
            )}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: pageSize }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="animate-fade-up rounded-2xl border border-white/10 bg-white/5 p-3"
                style={cardDelay(index)}
              >
                <div className="h-28 rounded-xl bg-white/10" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-1/2 rounded bg-white/10" />
                  <div className="h-3 w-1/3 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="ui-card p-8 text-center">
            <div className="font-display text-lg text-white">
              No events found
            </div>
            <div className="mt-1 text-sm text-(--subtext)">
              Try adjusting your filters or keyword search.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(renderEventCard)}
          </div>
        )}

        {!loading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/70">
            <div>
              Page <span className="text-white">{page}</span> of{" "}
              <span className="text-white">{totalPages}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              {pageButtons.map((pageNumber, index) => {
                const prevPage = pageButtons[index - 1];
                const showGap =
                  typeof prevPage === "number" && pageNumber - prevPage > 1;
                return (
                  <Fragment key={pageNumber}>
                    {showGap && <span className="px-1 text-white/40">...</span>}
                    <button
                      type="button"
                      onClick={() => goToPage(pageNumber)}
                      className={[
                        "rounded-lg border px-2 py-1 text-xs transition",
                        pageNumber === page
                          ? "border-emerald-300/60 bg-emerald-300/20 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/15",
                      ].join(" ")}
                    >
                      {pageNumber}
                    </button>
                  </Fragment>
                );
              })}
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-display text-xl text-white sm:text-2xl">
              Previous Event
            </div>
            <div className="text-xs text-(--subtext)">
              Recently finished events you might have missed.
            </div>
          </div>
          <div className="text-xs text-white/70">
            {pastLoading ? "Loading..." : `${pastItems.length} events`}
          </div>
        </div>

        {pastErr && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-100">
            {pastErr}
          </div>
        )}

        {pastLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: pastLimit }).map((_, index) => (
              <div
                key={`past-skeleton-${index}`}
                className="animate-fade-up rounded-2xl border border-white/10 bg-white/5 p-3"
                style={cardDelay(index)}
              >
                <div className="h-28 rounded-xl bg-white/10" />
                <div className="mt-3 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-white/10" />
                  <div className="h-3 w-1/2 rounded bg-white/10" />
                  <div className="h-3 w-1/3 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : pastItems.length === 0 ? (
          <div className="ui-card p-8 text-center">
            <div className="font-display text-lg text-white">
              No previous events
            </div>
            <div className="mt-1 text-sm text-(--subtext)">
              Past events will appear here once they finish.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastItems.map(renderEventCard)}
          </div>
        )}
      </section>
    </div>
  );
}
