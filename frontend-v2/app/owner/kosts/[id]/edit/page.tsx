
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Images, Settings} from "lucide-react";
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

    const responseText = await response.text();

    console.log("GET KOST STATUS:", response.status);
    console.log("GET KOST RESPONSE:", responseText);

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Server tidak mengembalikan JSON. HTTP ${response.status}. Cek Console.`,
      );
    }

    if (!response.ok || result.status === "error") {
      throw new Error(
        result.error?.message ??
        result.message ??
        "Gagal mengambil data kost",
      );
    }

    const kost = result.data;

    if (!kost) {
      throw new Error("Data kost tidak ditemukan.");
    }

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
    setError(
      err instanceof Error ? err.message : "Terjadi kesalahan",
    );
  } finally {
    setFetching(false);
  }
}

    fetchKost();
  }, [id, user, loading, router]);

  function updateField(field: keyof KostForm, value: string) {
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
      const response = await fetch(`/api/owner/kosts/${id}`, {
        method: "PUT",
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
          "Gagal memperbarui kost",
        );
      }

      router.push("/owner/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || fetching) {
    return <p className="dashboard-loading">Memuat data kost...</p>;
  }

  if (!user || user.role !== "owner") return null;

  return (
    <main className="owner-dashboard">
      <Link href="/owner/dashboard" className="create-back-link">
        <ArrowLeft size={18} />
        Kembali ke Dashboard
      </Link>

      <div className="create-kost-header">
        <h1>Edit Kost</h1>
        <p>Perbarui informasi properti kost kamu.</p>
      </div>

      <form className="create-kost-form" onSubmit={handleSubmit}>
        <div className="create-form-group">
          <label>Nama Kost</label>
          <input
            required
            maxLength={150}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
          />
        </div>

        <div className="create-form-group">
          <label>Deskripsi</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
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
            />
          </div>

          <div className="create-form-group">
            <label>Kamar Tersedia</label>
            <input
              type="number"
              required
              min="0"
              value={form.available_rooms}
              onChange={(e) =>
                updateField("available_rooms", e.target.value)
              }
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
          />
        </div>

        <div className="create-form-row">
          <div className="create-form-group">
            <label>Kota / Kabupaten</label>
            <input
              required
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>

          <div className="create-form-group">
            <label>Provinsi</label>
            <input
              required
              value={form.province}
              onChange={(e) => updateField("province", e.target.value)}
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
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>

        <Link
  href={`/owner/kosts/${id}/images`}
  className="create-back-link"
>
  <Images size={18} />
  Kelola Foto Kost
</Link>

<Link
  href={`/owner/kosts/${id}/facilities`}
  className="create-back-link"
>
  <Settings size={18} />
  Kelola Fasilitas
</Link>
      </form>
    </main>
  );
}
