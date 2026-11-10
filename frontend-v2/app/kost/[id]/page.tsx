
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  BedDouble,
  MessageCircle,
  CheckCircle,
} from "lucide-react";

import type { KostDetail } from "@/types/kost";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

function getWhatsAppUrl(phone: string) {
  const normalized = phone.replace(/\D/g, "").replace(/^0/, "62");

  return `https://wa.me/${normalized}`;
}

export default async function KostDetailPage({ params }: PageProps) {
  const { id } = await params;

  let response: Response;

  try {
    response = await fetch(
      `${process.env.API_URL}/kosts/${id}`,
      {
        cache: "no-store",
      }
    );
  } catch (error) {
    console.error("Gagal menghubungi API:", error);
    throw new Error("Tidak dapat terhubung ke server KostKita.");
  }

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(
      `API gagal mengambil data kost. Status: ${response.status}`
    );
  }

  const result = await response.json();

  if (result.status !== "success" || !result.data) {
    notFound();
  }

  const kost = result.data as KostDetail;

  const mainImage = kost.images?.[0]?.image_url;
  const owner = kost.owner;

  const ownerName =
    owner?.name || "Informasi pemilik belum tersedia";

  const ownerPhone = owner?.phone?.trim() || "";

  const facilities = kost.facilities ?? [];
  const images = kost.images ?? [];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">

        {/* Back button */}
        <Link
          href="/"
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Kembali ke halaman utama
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">

          {/* Image gallery */}
          <div>
            {mainImage ? (
              <img
                src={mainImage}
                alt={kost.name || "Foto kost"}
                className="h-80 w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="flex h-80 items-center justify-center rounded-2xl bg-slate-200 text-slate-500">
                Belum ada foto
              </div>
            )}

            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {images.slice(1).map((image) => (
                  <img
                    key={image.id}
                    src={image.image_url}
                    alt={kost.name || "Foto kost"}
                    className="h-24 w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Kost information */}
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin size={16} />
              {[kost.city, kost.province]
                .filter(Boolean)
                .join(", ") || "Lokasi belum tersedia"}
            </div>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              {kost.name || "Nama kost belum tersedia"}
            </h1>

            <p className="mt-4 text-2xl font-bold text-indigo-600">
              {formatPrice(Number(kost.price) || 0)}
              <span className="text-sm font-normal text-slate-500">
                {" "} / bulan
              </span>
            </p>

            {/* Available rooms */}
            <div className="mt-6 flex items-center gap-2 text-slate-600">
              <BedDouble size={20} />
              {kost.available_rooms ?? 0} kamar tersedia
            </div>

            {/* Address */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">
                Alamat
              </h2>

              <p className="mt-2 text-slate-600">
                {kost.address || "Alamat belum tersedia"}
              </p>
            </div>

            {/* Description */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">
                Deskripsi
              </h2>

              <p className="mt-2 whitespace-pre-line text-slate-600">
                {kost.description || "Belum ada deskripsi kost."}
              </p>
            </div>

            {/* Facilities */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">
                Fasilitas
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                {facilities.length > 0 ? (
                  facilities.map((facility) => (
                    <span
                      key={facility.id}
                      className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
                    >
                      <CheckCircle
                        size={15}
                        className="text-green-600"
                      />
                      {facility.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Belum ada fasilitas yang ditambahkan.
                  </p>
                )}
              </div>
            </div>

            {/* Owner contact */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">
                Pemilik kost
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {ownerName}
              </p>

              {ownerPhone ? (
                <a
                  href={getWhatsAppUrl(ownerPhone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700"
                >
                  <MessageCircle size={20} />
                  Hubungi via WhatsApp
                </a>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Nomor WhatsApp pemilik belum tersedia.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
