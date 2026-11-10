
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ImagePlus,
  Trash2,
  Images,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type KostImage = {
  id: number;
  kost_id: number;
  image_url: string;
  sort_order: number;
  created_at: string;
};

type Kost = {
  id: number;
  name: string;
  images: KostImage[];
};

export default function KostImagesPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { user, loading } = useAuth();

  const [kost, setKost] = useState<Kost | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState("");
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadKost() {
    const response = await fetch(`/api/owner/kosts/${id}`, {
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || result.status === "error") {
      throw new Error(
        result.error?.message ??
        result.message ??
        "Gagal mengambil data kost",
      );
    }

    setKost(result.data);
  }

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

    async function fetchData() {
      try {
        await loadKost();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Terjadi kesalahan",
        );
      } finally {
        setFetching(false);
      }
    }

    fetchData();
  }, [id, user, loading, router]);

  function handleUrlChange(value: string) {
    setImageUrl(value);
    setPreview(value.trim());
  }

  async function handleAddImage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    const url = imageUrl.trim();

    try {
      new URL(url);

      if (!/^https?:$/.test(new URL(url).protocol)) {
        throw new Error("URL harus menggunakan HTTP atau HTTPS");
      }
    } catch {
      setError("Masukkan URL gambar yang valid.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/owner/kosts/${id}/images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: url,
            sort_order: kost?.images?.length ?? 0,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || result.status === "error") {
        throw new Error(
          result.error?.message ??
          result.message ??
          "Gagal menambahkan gambar",
        );
      }

      await loadKost();

      setImageUrl("");
      setPreview("");
      setMessage("Gambar berhasil ditambahkan!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteImage(image: KostImage) {
    const confirmed = window.confirm(
      "Apakah kamu yakin ingin menghapus gambar ini?",
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/owner/kosts/${id}/images/${image.id}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (!response.ok || result.status === "error") {
        throw new Error(
          result.error?.message ??
          result.message ??
          "Gagal menghapus gambar",
        );
      }

      setKost((previous) =>
        previous
          ? {
              ...previous,
              images: previous.images.filter(
                (item) => item.id !== image.id,
              ),
            }
          : previous,
      );

      setMessage("Gambar berhasil dihapus.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    }
  }

  if (loading || fetching) {
    return (
      <main className="dashboard-loading">
        Memuat galeri gambar...
      </main>
    );
  }

  if (!user || user.role !== "owner") return null;

  if (!kost) {
    return (
      <main className="owner-dashboard">
        <p>{error || "Data kost tidak ditemukan."}</p>
        <Link href="/owner/dashboard">
          Kembali ke Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="owner-dashboard">
      <Link
        href={`/owner/kosts/${id}/edit`}
        className="create-back-link"
      >
        <ArrowLeft size={18} />
        Kembali ke Edit Kost
      </Link>

      <div className="create-kost-header">
        <p className="dashboard-eyebrow">KELOLA PROPERTI</p>
        <h1>Galeri Foto Kost</h1>
        <p>Kelola foto untuk properti: {kost.name}</p>
      </div>

      <section className="create-kost-form">
        <h2>Tambah Foto</h2>

        <form onSubmit={handleAddImage}>
          <div className="create-form-group">
            <label htmlFor="image_url">URL Gambar</label>
            <input
              id="image_url"
              type="url"
              placeholder="https://example.com/foto-kost.jpg"
              value={imageUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
            />
          </div>

          {preview && (
            <div className="kost-image-preview">
              <p>Preview gambar</p>
              <img
                src={preview}
                alt="Preview gambar kost"
                onError={() => setPreview("")}
              />
            </div>
          )}

          <button
            type="submit"
            className="dashboard-add-button"
            disabled={saving}
          >
            <ImagePlus size={18} />
            {saving ? "Menyimpan..." : "Tambah Gambar"}
          </button>
        </form>

        {error && (
          <p className="create-form-error">{error}</p>
        )}

        {message && (
          <p className="kost-image-success">{message}</p>
        )}
      </section>

      <section className="dashboard-list">
        <div className="kost-image-heading">
          <h2>Foto Properti</h2>
          <span>{kost.images?.length ?? 0} foto</span>
        </div>

        {!kost.images || kost.images.length === 0 ? (
          <div className="dashboard-empty">
            <Images size={42} />
            <h3>Belum Ada Foto</h3>
            <p>
              Tambahkan foto kamar, bangunan, atau fasilitas
              untuk mempercantik listing kost kamu.
            </p>
          </div>
        ) : (
          <div className="kost-image-grid">
            {kost.images.map((image) => (
              <article className="kost-image-card" key={image.id}>
                <img
                  src={image.image_url}
                  alt={`Foto ${kost.name}`}
                  loading="lazy"
                />

                <button
                  type="button"
                  onClick={() => handleDeleteImage(image)}
                  className="dashboard-delete-button"
                >
                  <Trash2 size={16} />
                  Hapus Foto
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
