"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { EVENT_CATEGORIES } from "@/lib/constants";

const MAX_IMAGE_MB = 5; // cukup aman utk poster
const MIN_IMAGE_KB = 20;

function bytesToMB(b: number) {
  return b / 1024 / 1024;
}
function bytesToKB(b: number) {
  return b / 1024;
}

export default function OrganizerCreateEventPage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(EVENT_CATEGORIES[0]);
  const [location, setLocation] = useState("Jakarta");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState(""); // datetime-local
  const [price, setPrice] = useState<number>(0);
  const [totalSeats, setTotalSeats] = useState<number>(100);
  const [isPublished, setIsPublished] = useState(true);

  // ✅ image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canAccess = useMemo(() => {
    if (loading) return false;
    return !!token && user?.role === "ORGANIZER";
  }, [loading, token, user]);

  const validateImage = (file: File) => {
    if (!file.type.startsWith("image/")) return "File harus berupa gambar (jpg/png/webp)";
    const kb = bytesToKB(file.size);
    const mb = bytesToMB(file.size);
    if (kb < MIN_IMAGE_KB) return `Ukuran gambar terlalu kecil (< ${MIN_IMAGE_KB}KB)`;
    if (mb > MAX_IMAGE_MB) return `Ukuran gambar maksimal ${MAX_IMAGE_MB}MB`;
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

    return null;
  };

  const uploadImage = async () => {
    setErr(null);
    if (!token) {
      router.push("/login");
      return;
    }
    if (!imageFile) {
      setErr("Pilih file gambar dulu");
      return;
    }
    const v = validateImage(imageFile);
    if (v) {
      setErr(v);
      return;
    }

    setUploading(true);
    try {
      const up = await uploadToCloudinary(imageFile, token, "event-platform/events");
      setImageUrl(up.secureUrl);
    } catch (e: any) {
      setErr(e.message || "Upload gagal");
    } finally {
      setUploading(false);
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

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const ok = window.confirm("Create event ini?");
    if (!ok) return;

    setSubmitting(true);
    try {
      const body: any = {
        name: name.trim(),
        category: category.trim(),
        location: location.trim(),
        description: description.trim(),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        price: Number(price),
        totalSeats: Number(totalSeats),
        isPublished,
      };

      if (imageUrl.trim()) body.imageUrl = imageUrl.trim();

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
      <div className="ui-card p-6 text-sm text-(--subtext)">
        Loading…
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="ui-card p-6">
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
      <div className="ui-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Create Event</div>
            <div className="mt-1 text-sm text-(--subtext)">Buat event baru. Free event = price 0.</div>
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

        {/* IMAGE */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Event Image</div>
              <div className="text-xs text-(--subtext) mt-1">
                Recommended: jpg/png/webp, min {MIN_IMAGE_KB}KB, max {MAX_IMAGE_MB}MB.
              </div>
            </div>

            {imageUrl ? (
              <button
                type="button"
                onClick={() => {
                  setImageUrl("");
                  setImageFile(null);
                }}
                className="px-3 py-2 rounded-xl bg-(--accent)/20 hover:bg-(--accent)/30 border border-(--accent)/40 text-sm"
              >
                Remove
              </button>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-(--surface) p-3">
              <div className="text-xs text-(--subtext)">Choose file</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="mt-2 w-full text-sm"
              />

              <button
                type="button"
                onClick={uploadImage}
                disabled={uploading || !imageFile}
                className={`mt-3 w-full px-4 py-3 rounded-xl text-sm border ${
                  uploading || !imageFile
                    ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                    : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
                }`}
              >
                {uploading ? "Uploading…" : "Upload to Cloudinary"}
              </button>

              {imageUrl && (
                <div className="mt-2 text-xs text-(--subtext)">
                  Uploaded ✅
                </div>
              )}
            </div>

            <div className="rounded-xl border border-white/10 bg-(--surface) p-3">
              <div className="text-xs text-(--subtext)">Preview</div>
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="preview" className="mt-2 h-44 w-full rounded-xl object-cover" />
              ) : (
                <div className="mt-2 h-44 w-full rounded-xl bg-white/5 flex items-center justify-center text-xs text-(--subtext)">
                  No image
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jakarta Tech Meetup"
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Category</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="ui-input mt-2"
            >
              {EVENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Location</div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Jakarta"
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Price (IDR)</div>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
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
            <div className="text-xs text-(--subtext)">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Meetup untuk networking developer"
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3">
            <div className="text-xs text-(--subtext)">Total Seats</div>
            <input
              type="number"
              min={1}
              value={totalSeats}
              onChange={(e) => setTotalSeats(Number(e.target.value))}
              className="ui-input mt-2"
            />
          </div>

          <div className="ui-panel p-3 flex items-center justify-between">
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
