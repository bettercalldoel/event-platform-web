"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";

const MAX_IMAGE_MB = 5;
const MIN_IMAGE_KB = 20;

function bytesToMB(b: number) {
  return b / 1024 / 1024;
}
function bytesToKB(b: number) {
  return b / 1024;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

type EventDetail = {
  id: number;
  name: string;
  description: string;
  category: string;
  location: string;
  startAt: string;
  endAt: string;
  price: number;
  totalSeats: number;
  remainingSeats: number;
  isPublished: boolean;
  imageUrl?: string | null;
  organizer: { id: number; name: string };
};

export default function OrganizerEditEventPage() {
  const router = useRouter();
  const params = useParams();
  const { user, token, loading } = useAuth();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    const s = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }, [params]);

  const [data, setData] = useState<EventDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState(""); // datetime-local
  const [endAt, setEndAt] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [totalSeats, setTotalSeats] = useState<number>(1);
  const [isPublished, setIsPublished] = useState(true);

  // image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>(""); // empty allowed = remove
  const [uploading, setUploading] = useState(false);

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

  const load = async () => {
    if (!id) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await api<EventDetail>(`/events/${id}`);
      setData(res);

      // prefill
      setName(res.name);
      setCategory(res.category);
      setLocation(res.location);
      setDescription(res.description);
      setStartAt(toLocalInput(res.startAt));
      setEndAt(toLocalInput(res.endAt));
      setPrice(res.price);
      setTotalSeats(res.totalSeats);
      setIsPublished(res.isPublished);
      setImageUrl(res.imageUrl ?? "");
    } catch (e: any) {
      setErr(e.message || "Failed to load event");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !token) {
      router.push("/login");
      return;
    }
    if (user.role !== "ORGANIZER") {
      router.push("/");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, token, id]);

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

  const onSave = async () => {
    setErr(null);
    if (!token) {
      router.push("/login");
      return;
    }
    if (!id) return;

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const ok = window.confirm("Simpan perubahan event ini?");
    if (!ok) return;

    setBusy(true);
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

      // ✅ imageUrl:
      // - kalau kosong => hapus
      // - kalau ada => update
      body.imageUrl = imageUrl.trim() ? imageUrl.trim() : "";

      await api(`/events/${id}`, { method: "PATCH", token, body });
      router.push(`/events/${id}`);
    } catch (e: any) {
      setErr(e.message || "Update failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || busy && !data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm text-(--subtext)">
        Loading event…
      </div>
    );
  }

  if (!id) {
    return (
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6 text-sm">
        Invalid event id
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-(--accent)/40 bg-(--accent)/10 p-4 text-sm">{err}</div>
        <Link href="/organizer" className="inline-block px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm">
          Back to Organizer
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-(--surface) p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">Edit Event</div>
            <div className="mt-1 text-sm text-(--subtext)">
              Update data event + update / remove image.
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/events/${id}`}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
            >
              View
            </Link>
            <Link
              href="/organizer"
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm"
            >
              Back
            </Link>
          </div>
        </div>

        {data?.organizer?.id && user?.id && data.organizer.id !== user.id && (
          <div className="mt-4 rounded-xl border border-(--accent)/40 bg-(--accent)/10 p-3 text-sm">
            Warning: event ini bukan milik kamu. Saat Save, backend akan menolak (403).
          </div>
        )}

        {/* IMAGE */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Event Image</div>
              <div className="text-xs text-(--subtext) mt-1">
                jpg/png/webp, min {MIN_IMAGE_KB}KB, max {MAX_IMAGE_MB}MB.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setImageUrl("");
                setImageFile(null);
              }}
              className="px-3 py-2 rounded-xl bg-(--accent)/20 hover:bg-(--accent)/30 border border-(--accent)/40 text-sm"
            >
              Remove Image
            </button>
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
                {uploading ? "Uploading…" : "Upload New Image"}
              </button>

              {imageUrl && (
                <div className="mt-2 text-xs text-(--subtext)">Current image set ✅</div>
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
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Name</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Category</div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-2 w-full rounded-xl bg-(--muted) border border-white/10 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-(--ring)"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-(--subtext)">Location</div>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
            <div className="mt-2 text-xs text-(--subtext)">
              Remaining saat ini: <b className="text-white">{data?.remainingSeats ?? "-"}</b>
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
          disabled={busy}
          className={`mt-5 w-full px-4 py-3 rounded-xl text-sm border ${
            busy
              ? "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"
              : "bg-(--primary)/25 hover:bg-(--primary)/35 border-(--primary)/40"
          }`}
        >
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
