
"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/api";
import type { Kost } from "@/lib/kost";

type FavoriteButtonProps = {
  kostId: number;
};

export default function FavoriteButton({ kostId }: FavoriteButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || user?.role !== "visitor") return;

    let active = true;

    async function checkFavorite() {
      try {
        const favorites = await apiRequest<Kost[]>("/favorites");

        if (active) {
          setIsFavorite(favorites.some((kost) => kost.id === kostId));
        }
      } catch {
        if (active) setError("Gagal memuat status favorit");
      }
    }

    checkFavorite();

    return () => {
      active = false;
    };
  }, [kostId, user?.id, user?.role, authLoading]);

  if (authLoading || user?.role !== "visitor") return null;

  async function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      if (isFavorite) {
        await apiRequest(`/favorites/${kostId}`, {
          method: "DELETE",
        });
        setIsFavorite(false);
      } else {
        await apiRequest(`/favorites/${kostId}`, {
          method: "POST",
        });
        setIsFavorite(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memperbarui favorit",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="favorite-button-wrapper">
      <button
        type="button"
        className={`favorite-button ${isFavorite ? "active" : ""}`}
        onClick={handleToggle}
        disabled={loading}
        aria-label={isFavorite ? "Hapus dari favorit" : "Tambah ke favorit"}
        title={error || (isFavorite ? "Hapus dari favorit" : "Tambah ke favorit")}
      >
        <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
