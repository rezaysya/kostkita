
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function CreateKostPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    address: "",
    city: "",
    province: "",
    available_rooms: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: keyof typeof form,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/owner/kosts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          "Gagal menambahkan kost",
        );
      }

      router.push("/owner/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Memuat...</p>;

  if (!user || user.role !== "owner") {
    return null;
  }

  return (
    <main className="owner-dashboard">
      <Link href="/owner/dashboard" className="create-back-link">
        <ArrowLeft size={18} />
        Kembali ke Dashboard
      </Link>

      <div className="create-kost-header">
        <h1>Tambah Kost Baru</h1>
        <p>Lengkapi informasi properti kost kamu.</p>
      </div>

      <form className="create-kost-form" onSubmit={handleSubmit}>
        <div className="create-form-group">
          <label>Nama Kost</label>
          <input
            required
            maxLength={150}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Contoh: Kost Minimalis Nyaman"
          />
        </div>

        <div className="create-form-group">
          <label>Deskripsi</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Jelaskan keunggulan kost kamu..."
          />
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>Harga per Bulan (Rp)</label>
            <input
              type="number"
              required
              min="0"
              value={form.price}
              onChange={(e) => updateField("price", e.target.value)}
              placeholder="1500000"
            />
          </div>

          <div className="create-form-group">
            <label>Jumlah Kamar Tersedia</label>
            <input
              type="number"
              required
              min="0"
              value={form.available_rooms}
              onChange={(e) =>
                updateField("available_rooms", e.target.value)
              }
              placeholder="5"
            />
          </div>
        </div>

        <div className="create-form-group">
          <label>Alamat Lengkap</label>
          <textarea
            required
            rows={3}
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            placeholder="Masukkan alamat lengkap kost"
          />
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>Kota / Kabupaten</label>
            <input
              required
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="Tangerang"
            />
          </div>

          <div className="create-form-group">
            <label>Provinsi</label>
            <input
              required
              value={form.province}
              onChange={(e) => updateField("province", e.target.value)}
              placeholder="Banten"
            />
          </div>
        </div>

        {error && <p className="create-form-error">{error}</p>}

        <button
          type="submit"
          className="dashboard-add-button"
          disabled={saving}
        >
          <Save size={18} />
          {saving ? "Menyimpan..." : "Simpan Kost"}
        </button>
      </form>
    </main>
  );
}
