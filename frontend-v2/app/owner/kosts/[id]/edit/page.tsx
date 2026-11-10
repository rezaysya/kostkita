
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Images,
  Settings,
  MapPin,
  Building2,
  Wallet,
  DoorOpen,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type KostForm = {
  name: string;
  description: string;
  price: string;
  address: string;
  city: string;
  province: string;
  available_rooms: string;
};

const initialForm: KostForm = {
  name: "",
  description: "",
  price: "",
  address: "",
  city: "",
  province: "",
  available_rooms: "",
};

export default function EditKostPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState<KostForm>(initialForm);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "owner") {
      router.replace("/");
      return;
    }

    async function fetchKost() {
      try {
        const response = await fetch(`/api/owner/kosts/${id}`, {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || result.status === "error") {
          throw new Error(
            result.error?.message ??
            result.message ??
            "Gagal mengambil data kost"
          );
        }

        const kost = result.data;

        if (!kost) throw new Error("Data kost tidak ditemukan.");

        setForm({
          name: kost.name ?? "",
          description: kost.description ?? "",
          price: String(kost.price ?? ""),
          address: kost.address ?? "",
          city: kost.city ?? "",
          province: kost.province ?? "",
          available_rooms: String(kost.available_rooms ?? ""),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setFetching(false);
      }
    }

    fetchKost();
  }, [id, user, loading, router]);

  function updateField(field: keyof KostForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch(`/api/owner/kosts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          available_rooms: Number(form.available_rooms),
        }),
      });

      const result = await response.json();

      if (!response.ok || result.status === "error") {
        throw new Error(
          result.error?.message ??
          result.message ??
          "Gagal memperbarui kost"
        );
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  if (loading || fetching) {
    return (
      <div className="edit-loading">
        <Loader2 className="edit-spinner" size={28} />
        <p>Memuat informasi kost...</p>
      </div>
    );
  }

  if (!user || user.role !== "owner") return null;

  return (
    <main className="edit-page">
      <div className="edit-container">
        <Link href="/owner/dashboard" className="edit-back">
          <ArrowLeft size={18} />
          <span>Kembali ke Dashboard</span>
        </Link>

        <header className="edit-header">
          <div>
            <span className="edit-eyebrow">OWNER DASHBOARD</span>
            <h1>Edit Properti Kost</h1>
            <p>Kelola informasi properti agar calon penghuni mendapatkan informasi yang akurat.</p>
          </div>
          <div className="edit-header-icon">
            <Building2 size={28} />
          </div>
        </header>

        <div className="edit-layout">
          <form className="edit-form" onSubmit={handleSubmit}>
            <section className="edit-card">
              <div className="edit-section-heading">
                <div className="edit-section-icon">
                  <Building2 size={19} />
                </div>
                <div>
                  <h2>Informasi Properti</h2>
                  <p>Informasi dasar mengenai kost kamu.</p>
                </div>
              </div>

              <div className="edit-field">
                <label htmlFor="name">Nama Kost <span>*</span></label>
                <input
                  id="name"
                  required
                  maxLength={150}
                  placeholder="Contoh: Kost Melati Residence"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>

              <div className="edit-field">
                <label htmlFor="description">Deskripsi Kost</label>
                <textarea
                  id="description"
                  rows={5}
                  placeholder="Ceritakan fasilitas, suasana, dan keunggulan kost kamu..."
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
                <small>Gunakan deskripsi yang jelas agar calon penghuni lebih tertarik.</small>
              </div>
            </section>

            <section className="edit-card">
              <div className="edit-section-heading">
                <div className="edit-section-icon">
                  <Wallet size={19} />
                </div>
                <div>
                  <h2>Harga & Ketersediaan</h2>
                  <p>Atur harga sewa dan jumlah kamar yang tersedia.</p>
                </div>
              </div>

              <div className="edit-grid">
                <div className="edit-field">
                  <label htmlFor="price">Harga per Bulan <span>*</span></label>
                  <div className="edit-input-prefix">
                    <span>Rp</span>
                    <input
                      id="price"
                      type="number"
                      required
                      min="0"
                      placeholder="1500000"
                      value={form.price}
                      onChange={(e) => updateField("price", e.target.value)}
                    />
                  </div>
                  <small>Masukkan harga dalam Rupiah.</small>
                </div>

                <div className="edit-field">
                  <label htmlFor="rooms">Kamar Tersedia <span>*</span></label>
                  <div className="edit-input-prefix">
                    <DoorOpen size={17} />
                    <input
                      id="rooms"
                      type="number"
                      required
                      min="0"
                      placeholder="5"
                      value={form.available_rooms}
                      onChange={(e) => updateField("available_rooms", e.target.value)}
                    />
                  </div>
                  <small>Jumlah kamar yang masih kosong.</small>
                </div>
              </div>
            </section>

            <section className="edit-card">
              <div className="edit-section-heading">
                <div className="edit-section-icon">
                  <MapPin size={19} />
                </div>
                <div>
                  <h2>Lokasi Properti</h2>
                  <p>Pastikan alamat kost mudah ditemukan.</p>
                </div>
              </div>

              <div className="edit-field">
                <label htmlFor="address">Alamat Lengkap <span>*</span></label>
                <textarea
                  id="address"
                  rows={3}
                  required
                  placeholder="Nama jalan, nomor bangunan, RT/RW, kelurahan..."
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                />
              </div>

              <div className="edit-grid">
                <div className="edit-field">
                  <label htmlFor="city">Kota / Kabupaten <span>*</span></label>
                  <input
                    id="city"
                    required
                    placeholder="Contoh: Tangerang"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                  />
                </div>

                <div className="edit-field">
                  <label htmlFor="province">Provinsi <span>*</span></label>
                  <input
                    id="province"
                    required
                    placeholder="Contoh: Banten"
                    value={form.province}
                    onChange={(e) => updateField("province", e.target.value)}
                  />
                </div>
              </div>
            </section>

            {error && (
              <div className="edit-alert edit-alert-error">
                <AlertCircle size={19} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="edit-alert edit-alert-success">
                <CheckCircle2 size={19} />
                <span>Informasi kost berhasil diperbarui.</span>
              </div>
            )}

            <div className="edit-submit-area">
              <Link href="/owner/dashboard" className="edit-cancel">
                Batal
              </Link>
              <button type="submit" className="edit-save" disabled={saving}>
                {saving ? (
                  <Loader2 size={18} className="edit-spinner" />
                ) : (
                  <Save size={18} />
                )}
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>

          <aside className="edit-sidebar">
            <div className="edit-side-card">
              <span className="edit-side-label">PENGELOLAAN</span>
              <h3>Lengkapi Properti</h3>
              <p>Informasi dan foto yang lengkap membantu calon penghuni mengenal kost kamu.</p>

              <Link href={`/owner/kosts/${id}/images`} className="edit-manage-link">
                <div className="edit-manage-icon">
                  <Images size={20} />
                </div>
                <div>
                  <strong>Foto Kost</strong>
                  <small>Kelola foto properti</small>
                </div>
                <ChevronRight size={18} />
              </Link>

              <Link href={`/owner/kosts/${id}/facilities`} className="edit-manage-link">
                <div className="edit-manage-icon">
                  <Settings size={20} />
                </div>
                <div>
                  <strong>Fasilitas Kost</strong>
                  <small>Atur fasilitas tersedia</small>
                </div>
                <ChevronRight size={18} />
              </Link>
            </div>

            <div className="edit-tip-card">
              <div className="edit-tip-icon">💡</div>
              <strong>Tips untuk Owner</strong>
              <p>Gunakan foto yang terang, deskripsi yang informatif, dan harga yang sesuai dengan kondisi properti.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
