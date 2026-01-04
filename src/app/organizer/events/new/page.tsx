"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_BYTES = 20 * 1024; // 20KB
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export default function OrganizerCreateEventPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tech");
  const [location, setLocation] = useState("Jakarta");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState(""); // datetime-local
  const [price, setPrice] = useState<number>(0);
  const [totalSeats, setTotalSeats] = useState<number>(100);
  const [isPublished, setIsPublished] = useState(true);

  // ✅ image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canAccess = useMemo(() => {
    if (loading) return false;
    return !!token && user?.role === "ORGANIZER";
  }, [loading, token, user]);

  const validateImage = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return "File harus JPG / PNG / WebP";
    }
    if (f.size < MIN_BYTES) {
      return "Ukuran gambar terlalu kecil (min 20KB)";
    }
    if (f.size > MAX_BYTES) {
      return "Ukuran gambar terlalu besar (max 5MB)";
    }
    return null;
  };

  const validate = () => {
    if (!name.trim()) return "Name wajib diisi";
    if (!category.trim()) return "Category wajib diisi";
    if (!location.trim()) return "Location wajib diisi";
    if (!description.trim()) return "Description wajib diisi";
    if (!startAt) return "startAt wajib diisi";
    if (!endAt) return "endAt wajib diisi";

    const s = new Date(startAt);
    const e = new Date(endAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "Tanggal tidak valid";
    if (e <= s) return "endAt harus setelah startAt";

    if (price < 0) return "Price tidak boleh negatif";
    if (totalSeats < 1) return "Total seats minimal 1";

    // ✅ untuk “nilai” lebih tinggi: wajib ada image
    if (!imageFile) return "Poster/thumbnail wajib diupload (imageUrl)";

    return null;
  };

  const onPickFile = (f: File | null) => {
    setErr(null);

    if (!f) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    const v = validateImage(f);
    if (v) {
      setImageFile(null);
      setImagePreview(null);
      setErr(v);
      return;
    }

    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const onSubmit = async () => {
    setErr(null);

    if (!token) {
      router.push("/login");
      return;
    }
    if (user?.role !== "ORGANIZER") {
      setErr("Akses ditolak. Login sebagai ORGANIZER.");
      return;
    }

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const ok = window.confirm("Create event ini?");
    if (!ok) return;

    setSubmitting(true);
    try {
      // 1) upload image ke cloudinary (signed)
      const uploaded = await uploadToCloudinary(imageFile!, token, "event-platform/events");

      // 2) create event ke backend pakai imageUrl
      const body = {
        name: name.trim(),
        category: category.trim(),
        location: location.trim(),
        description: description.trim(),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        price: Number(price),
        totalSeats: Number(totalSeats),
        isPublished,
        imageUrl: uploaded.secureUrl, // ✅
      };

      const res = await api<{ message: string; id: number }>(`/events`, {
        method: "POST",
        token,
        body,
      });

      router.push(`/events/${res.id}`);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
        Loading…
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="text-xl font-semibold">Create Event</div>
        <div className="mt-2 text-sm text-(--subtext)">Halaman ini khusus ORGANIZER.</div>

        <div className="mt-4 flex gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-xl bg-(--primary)/25 hover:bg-(--primary)/35 border border-(--primary)/40 text-sm"
          >
            Login
          </Link>
          <Link href="/" className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Create Event</div>
            <div className="mt-1 text-sm text-(--subtext)">
              Upload 1 gambar (imageUrl) untuk poster/thumbnail. JPG/PNG/WebP, 20KB–5MB.
            </div>
          </div>
          <Link href="/" className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
            Browse Events
          </Link>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {err}
          </div>
        )}

        {/* Image uploader */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Event Image</div>
          <div className="text-xs text-(--subtext) mt-1">
            Rekomendasi: rasio 16:9, resolusi min 1200x675.
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 items-start">
            <div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />

              {imageFile && (
                <div className="mt-2 text-xs text-(--subtext)">
                  Selected: <span className="text-white">{imageFile.name}</span> ({Math.round(imageFile.size / 1024)} KB)
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-(--muted) overflow-hidden">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-xs text-(--subtext)">
                  Preview
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jakarta Tech Meetup"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Category</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Tech"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Location</div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jakarta"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Price (IDR)</div>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Start At</div>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">End At</div>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
            <div className="text-xs text-(--subtext)">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Meetup untuk networking developer"
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Total Seats</div>
            <input
              type="number"
              min={1}
              value={totalSeats}
              onChange={(e) => setTotalSeats(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-(--subtext)">Publish</div>
              <div className="text-sm">Tampilkan di landing page</div>
            </div>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-5 w-5"
            />
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={submitting}
          className={`mt-5 w-full px-4 py-3 rounded-xl text-sm border ${
            submitting
              ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
              : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
          }`}
        >
          {submitting ? "Creating…" : "Create Event"}
        </button>
      </div>
    </div>
  );
}
