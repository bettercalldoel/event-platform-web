import { api } from "@/lib/api";

export async function uploadToCloudinary(file: File, token: string, folder: string) {
  // minta signature dari backend
  const sig = await api<{
    timestamp: number;
    signature: string;
    cloudName: string;
    apiKey: string;
    folder: string;
  }>("/uploads/signature", {
    method: "POST",
    token,
    body: { folder },
  });

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`;

  const res = await fetch(uploadUrl, { method: "POST", body: form });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error?.message || "Cloudinary upload failed");
  }

  return {
    secureUrl: json.secure_url as string,
    publicId: json.public_id as string,
  };
}
