"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

const MAX_FILE_MB = 5;
const MIN_W = 800;
const MIN_H = 450;

async function getImageSize(file: File): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Invalid image"));
      img.src = url;
    });
    return { w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function OrganizerCreateEventPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tech");
  const [location, setLocation] = useState("Jakarta");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [totalSeats, setTotalSeats] = useState<number>(100);
  const [isPublished, setIsPublished] = useState(true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canAccess = useMemo(() => {
    if (loading) return false;
    return !!token && user?.role === "ORGANIZER";
  }, [loading, token, user]);

  const validate = async () => {
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

    // ✅ image wajib (biar gak ada “No Image”)
    if (!imageFile) return "Poster/thumbnail wajib diupload";

    // validate size & type
    const okType = ["image/jpeg", "image/png", "image/webp"].includes(imageFile.type);
    if (!okType) return "Format image harus JPG/PNG/WEBP";

    const maxBytes = MAX_FILE_MB * 1024 * 1024;
    if (imageFile.size > maxBytes) return `Ukuran image max ${MAX_FILE_MB}MB`;

    // validate dimensions
    const { w, h } = await getImageSize(imageFile);
    if (w < MIN_W || h < MIN_H) return `Resolusi minimal ${MIN_W}x${MIN_H}`;

    return null;
  };

  const onPickImage = async (file: File | null) => {
    setErr(null);
    setImageFile(null);
    setImagePreview(null);

    if (!file) return;

    const okType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!okType) {
      setErr("Format image harus JPG/PNG/WEBP");
      return;
    }

    const maxBytes = MAX_FILE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setErr(`Ukuran image max ${MAX_FILE_MB}MB`);
      return;
    }

    try {
      const { w, h } = await getImageSize(file);
      if (w < MIN_W || h < MIN_H) {
        setErr(`Resolusi minimal ${MIN_W}x${MIN_H}`);
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    } catch {
      setErr("File image tidak valid");
    }
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

    const v = await validate();
    if (v) {
      setErr(v);
      return;
    }

    const ok = window.confirm("Create event ini?");
    if (!ok) return;

    setSubmitting(true);
    try {
      // ✅ upload cloudinary dulu
      let imageUrl: string | null = null;
      if (imageFile) {
        const up = await uploadToCloudinary(imageFile, token, "event-platform/events");
        imageUrl = up.secureUrl;
      }

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
        imageUrl, // ✅ kirim ke backend
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
              Poster wajib. Format JPG/PNG/WEBP, max {MAX_FILE_MB}MB, min {MIN_W}x{MIN_H}.
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

        {/* IMAGE PICKER */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Event Image</div>
          <div className="text-xs text-(--subtext) mt-1">
            Gunakan poster landscape biar bagus di card & detail.
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
              className="text-sm"
            />

            {imagePreview ? (
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-24 w-40 rounded-xl object-cover border border-white/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="text-xs text-(--subtext)">No image selected</div>
            )}
          </div>
        </div>

        {/* FORM */}
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
