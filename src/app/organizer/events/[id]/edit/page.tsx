"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

type OrgEventDetail = {
  id: number;
  name: string;
  category: string;
  location: string;
  description: string;
  startAt: string;
  endAt: string;
  price: number;
  totalSeats: number;
  remainingSeats: number;
  isPublished: boolean;
  imageUrl?: string | null;
};

function toLocalDateTimeInput(iso: string) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

function validateImage(file: File) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const min = 10 * 1024; // 10KB
  const max = 5 * 1024 * 1024; // 5MB

  if (!allowed.includes(file.type)) return "Format harus JPG/PNG/WebP";
  if (file.size < min) return "Ukuran gambar terlalu kecil (min 10KB)";
  if (file.size > max) return "Ukuran gambar terlalu besar (max 5MB)";
  return null;
}

export default function OrganizerEditEventPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, loading } = useAuth();

  const authToken = token ?? (typeof window !== "undefined" ? localStorage.getItem("token") : null);

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState(""); // datetime-local
  const [price, setPrice] = useState<number>(0);
  const [totalSeats, setTotalSeats] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(true);

  // image
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!authToken) return;
    const res = await api<{ event: OrgEventDetail }>(`/organizer/events/${id}`, { token: authToken });
    const e = res.event;

    setName(e.name ?? "");
    setCategory(e.category ?? "");
    setLocation(e.location ?? "");
    setDescription(e.description ?? "");
    setStartAt(toLocalDateTimeInput(e.startAt));
    setEndAt(toLocalDateTimeInput(e.endAt));
    setPrice(Number(e.price ?? 0));
    setTotalSeats(Number(e.totalSeats ?? 1));
    setIsPublished(!!e.isPublished);
    setImageUrl(e.imageUrl ?? "");
  };

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "ORGANIZER") {
      router.push("/");
      return;
    }
    if (!authToken) {
      setErr("Token tidak ditemukan. Coba logout lalu login lagi.");
      setBusy(false);
      return;
    }
    if (!id) return;

    setBusy(true);
    setErr(null);
    load()
      .catch((e: any) => setErr(e.message))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, authToken, id]);

  const onPickImage = (file: File | null) => {
    setErr(null);
    setImageFile(null);
    if (!file) return;

    const v = validateImage(file);
    if (v) {
      setErr(v);
      return;
    }
    setImageFile(file);
  };

  const uploadImage = async () => {
    setErr(null);
    if (!authToken) {
      router.push("/login");
      return;
    }
    if (!imageFile) {
      setErr("Pilih file gambar dulu.");
      return;
    }

    setUploading(true);
    try {
      const up = await uploadToCloudinary(imageFile, authToken, "event-platform/events");
      setImageUrl(up.secureUrl);
      setImageFile(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
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

  const onSave = async () => {
    setErr(null);

    if (!authToken) {
      router.push("/login");
      return;
    }

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const ok = window.confirm("Update event ini?");
    if (!ok) return;

    setSubmitting(true);
    try {
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
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
      };

      await api(`/events/${id}`, { method: "PATCH", token: authToken, body });

      router.push("/organizer");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (busy) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
        Loading event…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Edit Event</div>
            <div className="mt-1 text-sm text-(--subtext)">Update info event + imageUrl.</div>
          </div>

          <div className="flex gap-2">
            <Link href="/organizer" className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
              Back
            </Link>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            {err}
          </div>
        )}

        {/* Image */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Event Image</div>
          <div className="text-xs text-(--subtext) mt-1">
            Saran: JPG/PNG/WebP, max 5MB. Cocok buat poster + thumbnail (gabung 1).
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl overflow-hidden border border-white/10 bg-(--surface)">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="event image" className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 flex items-center justify-center text-xs text-(--subtext)">
                  No image
                </div>
              )}
            </div>

            <div className="space-y-2">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />

              <button
                type="button"
                onClick={uploadImage}
                disabled={!imageFile || uploading}
                className={`w-full px-4 py-3 rounded-xl text-sm border ${
                  !imageFile || uploading
                    ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
                    : "bg-(--primary)/20 hover:bg-(--primary)/30 border-(--primary)/40"
                }`}
              >
                {uploading ? "Uploading…" : "Upload to Cloudinary"}
              </button>

              <div className="text-xs text-(--subtext)">
                Current imageUrl:
                <div className="break-all mt-1">{imageUrl ? imageUrl : "-"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Category</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Location</div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Price (IDR)</div>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Start At</div>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">End At</div>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3 md:col-span-2">
            <div className="text-xs text-(--subtext)">Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Total Seats</div>
            <input
              type="number"
              min={1}
              value={totalSeats}
              onChange={(e) => setTotalSeats(Number(e.target.value))}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none"
            />
            <div className="text-xs text-(--subtext) mt-1">
              Note: tidak boleh lebih kecil dari seats yang sudah terpakai.
            </div>
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
          onClick={onSave}
          disabled={submitting}
          className={`mt-5 w-full px-4 py-3 rounded-xl text-sm border ${
            submitting
              ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
              : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
          }`}
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
