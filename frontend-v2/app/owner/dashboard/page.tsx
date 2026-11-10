
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Building2,
  Home,
  Clock,
  Trash2,
} from "lucide-react";
import Navbar from "@/components/navbar";
import { useAuth } from "@/components/AuthProvider";

type Kost = {
  id: number;
  name: string;
  price: number;
  city: string;
  status: "draft" | "published" | "rejected";
};

export default function OwnerDashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [kosts, setKosts] = useState<Kost[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  
  async function handleDeleteKost(id: number, name: string) {
  const confirmed = window.confirm(
    `Apakah kamu yakin ingin menghapus kost "${name}"?`,
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/owner/kosts/${id}`, {
      method: "DELETE",
    });

    const responseText = await response.text();
    let result = null;

    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error("Respons server tidak valid");
      }
    }

    if (!response.ok) {
      throw new Error(
        result?.error?.message ??
        result?.message ??
        "Gagal menghapus kost",
      );
    }

    setKosts((previous) =>
      previous.filter((kost) => kost.id !== id),
    );
  } catch (err) {
    alert(
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menghapus kost",
    );
  }
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

async function handleDeleteKost(id: number, name: string) {
  const confirmed = window.confirm(
    `Apakah kamu yakin ingin menghapus kost "${name}"?`,
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`/api/owner/kosts/${id}`, {
      method: "DELETE",
    });

    const responseText = await response.text();

    let result = null;

    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error("Respons server tidak valid");
      }
    }

    if (!response.ok) {
      throw new Error(
        result?.error?.message ??
        result?.message ??
        "Gagal menghapus kost",
      );
    }

    setKosts((previous) =>
      previous.filter((kost) => kost.id !== id),
    );
  } catch (err) {
    alert(
      err instanceof Error
        ? err.message
        : "Terjadi kesalahan saat menghapus kost",
    );
  }
}

    async function fetchKosts() {
      try {
        const response = await fetch("/api/owner/kosts", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ?? "Gagal mengambil data kost",
          );
        }

        setKosts(result.data ?? []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Terjadi kesalahan",
        );
      } finally {
        setFetching(false);
      }
    }

    fetchKosts();
  }, [user, loading, router]);

  const published = kosts.filter(
    (kost) => kost.status === "published",
  ).length;

  const drafts = kosts.filter(
    (kost) => kost.status === "draft",
  ).length;

  if (loading || fetching) {
    return <main className="dashboard-loading">Memuat dashboard...</main>;
  }

  if (!user || user.role !== "owner") {
    return null;
  }

  return (
    <>
      <Navbar />

      <main className="owner-dashboard">
        <div className="dashboard-header">
          <div>
            <p className="dashboard-eyebrow">OWNER PANEL</p>
            <h1>Dashboard</h1>
            <p>Halo, {user.name}! Kelola properti kost kamu di sini.</p>
          </div>

          <Link href="/owner/kosts/create" className="dashboard-add-button">
            <Plus size={18} />
            Tambah Kost
          </Link>
        </div>

        <section className="dashboard-stats">
          <div className="dashboard-stat">
            <Building2 />
            <div>
              <strong>{kosts.length}</strong>
              <span>Total Kost</span>
            </div>
          </div>

          <div className="dashboard-stat">
            <Home />
            <div>
              <strong>{published}</strong>
              <span>Kost Published</span>
            </div>
          </div>

          <div className="dashboard-stat">
            <Clock />
            <div>
              <strong>{drafts}</strong>
              <span>Kost Draft</span>
            </div>
          </div>
        </section>

        <section className="dashboard-list">
          <h2>Daftar Kost Saya</h2>

          {error ? (
            <p>{error}</p>
          ) : kosts.length === 0 ? (
            <div className="dashboard-empty">
              <Building2 size={42} />
              <h3>Belum Ada Kost</h3>
              <p>
                Kamu belum memiliki properti kost.
                Mulai tambahkan kost pertamamu sekarang.
              </p>
              <Link
                href="/owner/kosts/create"
                className="dashboard-add-button"
              >
                <Plus size={18} />
                Tambah Kost Pertama
              </Link>
            </div>
          ) : (
            <div className="dashboard-kost-list">
  <div className="dashboard-kost-list">
  {kosts.map((kost) => (
    <article className="dashboard-kost-item" key={kost.id}>
      <div>
        <h3>{kost.name}</h3>
        <p>
          {kost.city} · Rp{kost.price.toLocaleString("id-ID")}
        </p>
      </div>

      <span className={`status-${kost.status}`}>
        {kost.status}
      </span>

      <div className="dashboard-kost-actions">
        <Link href={`/owner/kosts/${kost.id}/edit`}>
          Edit
        </Link>

        <button
          type="button"
          className="dashboard-delete-button"
          onClick={() => handleDeleteKost(kost.id, kost.name)}
        >
          <Trash2 size={16} />
          Hapus
        </button>
      </div>
    </article>
  ))}
</div>
</div>
          )}
        </section>
      </main>
    </>
  );
}
