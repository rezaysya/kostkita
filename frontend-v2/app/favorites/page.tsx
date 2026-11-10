
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/api";
import { Kost } from "@/lib/kost";
import KostCard from "@/components/KostCard";

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();

  const [favorites, setFavorites] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (user?.role !== "visitor") {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadFavorites() {
      try {
        setLoading(true);
        const result = await apiRequest<Kost[]>("/favorites");

        if (active) {
          setFavorites(result);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Gagal mengambil data favorit",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFavorites();

    return () => {
      active = false;
    };
  }, [user?.id, user?.role, authLoading]);

  if (authLoading || loading) {
    return <main className="container"><p>Memuat favorit...</p></main>;
  }

  if (!user || user.role !== "visitor") {
    return (
      <main className="container">
        <h2>Favorit Pengunjung</h2>
        <p>Silakan login menggunakan akun visitor untuk melihat favorit.</p>
        <Link href="/login" className="btn btn-primary">
          Login
        </Link>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="favorites-header">
        <div>
          <Link href="/" className="favorites-back">
            <ArrowLeft size={16} /> Kembali
          </Link>
          <h1>Kost Favorit Saya</h1>
          <p>Kumpulan kost yang kamu simpan.</p>
        </div>

        <div className="favorites-count">
          <Heart size={18} />
          {favorites.length} kost
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!error && favorites.length === 0 ? (
        <div className="favorites-empty">
          <Heart size={42} />
          <h3>Belum ada kost favorit</h3>
          <p>Simpan kost yang kamu sukai dengan menekan ikon hati.</p>
          <Link href="/kost" className="btn btn-primary">
            Cari Kost
          </Link>
        </div>
      ) : (
        <div className="kost-grid">
          {favorites.map((kost) => (
            <KostCard key={kost.id} kost={kost} />
          ))}
        </div>
      )}
    </main>
  );
}
