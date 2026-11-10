
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/api";
import {
  Search,
  MapPin,
  BedDouble,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import Navbar from "@/components/navbar";

type KostImage = {
  id: number;
  kost_id: number;
  image_url: string;
  sort_order: number;
};

type AdminKost = {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  price: number;
  address: string;
  city: string;
  province: string;
  available_rooms: number;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  owner: {
    name: string;
    phone: string | null;
  };
  images: KostImage[];
};

type KostStatus = AdminKost["status"];

const statusLabels: Record<KostStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function AdminKostsPage() {
  const { user, loading: authLoading } = useAuth();

  const [kosts, setKosts] = useState<AdminKost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadKosts() {
    try {
      setError("");

      const data = await apiRequest<AdminKost[]>("/admin/kosts");
      setKosts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat data kost"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      loadKosts();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user?.role]);

  const filteredKosts = useMemo(() => {
    return kosts.filter((kost) => {
      const keyword = search.toLowerCase();

      const matchesSearch =
        kost.name.toLowerCase().includes(keyword) ||
        kost.city.toLowerCase().includes(keyword) ||
        kost.owner.name.toLowerCase().includes(keyword);

      const matchesStatus =
        filterStatus === "all" || kost.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [kosts, search, filterStatus]);

  const stats = {
    total: kosts.length,
    published: kosts.filter((kost) => kost.status === "published").length,
    draft: kosts.filter((kost) => kost.status === "draft").length,
    archived: kosts.filter((kost) => kost.status === "archived").length,
  };

  async function updateStatus(id: number, status: KostStatus) {
    try {
      setSavingId(id);

      await apiRequest(`/admin/kosts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await loadKosts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteKost(id: number, name: string) {
    const confirmed = window.confirm(
      `Yakin ingin menghapus kost "${name}"? Tindakan ini tidak dapat dibatalkan.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);

      await apiRequest(`/admin/kosts/${id}`, {
        method: "DELETE",
      });

      setKosts((previous) => previous.filter((kost) => kost.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus kost");
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || loading) {
    return <main className="page-container">Memuat data kost...</main>;
  }

  if (user?.role !== "admin") {
    return <main className="page-container">Akses hanya untuk admin.</main>;
  }

  return (
    <>
    <Navbar />
    <main className="page-container">
      <div className="page-header">
        <div>
          <h1>Manajemen Kost</h1>
          <p>Kelola seluruh listing kost yang terdaftar di KostKita.</p>
        </div>

        <button
          className="admin-refresh-button"
          onClick={loadKosts}
          type="button"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      <section className="admin-kost-stats">
        <div className="admin-kost-stat">
          <span>Total Kost</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="admin-kost-stat">
          <span>Published</span>
          <strong>{stats.published}</strong>
        </div>

        <div className="admin-kost-stat">
          <span>Draft</span>
          <strong>{stats.draft}</strong>
        </div>

        <div className="admin-kost-stat">
          <span>Archived</span>
          <strong>{stats.archived}</strong>
        </div>
      </section>

      <section className="admin-kost-panel">
        <div className="admin-kost-toolbar">
          <div className="admin-kost-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Cari nama kost, kota, atau pemilik..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="admin-kost-list">
          {filteredKosts.length === 0 ? (
            <div className="admin-kost-empty">
              <ImageIcon size={36} />
              <h3>Kost tidak ditemukan</h3>
              <p>Coba ubah kata kunci atau filter status.</p>
            </div>
          ) : (
            filteredKosts.map((kost) => {
              const thumbnail = kost.images?.[0]?.image_url;

              return (
                <article className="admin-kost-card" key={kost.id}>
                  <div className="admin-kost-image">
                    {thumbnail ? (
                      <img src={thumbnail} alt={kost.name} />
                    ) : (
                      <div className="admin-kost-no-image">
                        <ImageIcon size={28} />
                        <span>Belum ada foto</span>
                      </div>
                    )}
                  </div>

                  <div className="admin-kost-content">
                    <div className="admin-kost-title-row">
                      <div>
                        <h3>{kost.name}</h3>
                        <span className="admin-kost-id">
                          ID Kost: #{kost.id}
                        </span>
                      </div>

                      <span
                        className={`kost-status-badge status-${kost.status}`}
                      >
                        {statusLabels[kost.status]}
                      </span>
                    </div>

                    <p className="admin-kost-owner">
                      Pemilik: <strong>{kost.owner?.name || "Tidak diketahui"}</strong>
                    </p>

                    <div className="admin-kost-meta">
                      <span>
                        <MapPin size={15} />
                        {kost.city}, {kost.province}
                      </span>

                      <span>
                        <BedDouble size={15} />
                        {kost.available_rooms} kamar tersedia
                      </span>

                      <span>
                        <ImageIcon size={15} />
                        {kost.images?.length || 0} foto
                      </span>
                    </div>

                    <strong className="admin-kost-price">
                      {formatPrice(kost.price)}
                    </strong>
                  </div>

                  <div className="admin-kost-actions">
                    <label>Ubah Status</label>

                    <select
                      value={kost.status}
                      disabled={
                        savingId === kost.id || deletingId === kost.id
                      }
                      onChange={(e) =>
                        updateStatus(kost.id, e.target.value as KostStatus)
                      }
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>

                    <a
                      href={`/kost/${kost.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-kost-detail-link"
                    >
                      <ExternalLink size={15} />
                      Lihat Detail
                    </a>

                    <button
                      type="button"
                      className="admin-kost-delete"
                      disabled={
                        deletingId === kost.id || savingId === kost.id
                      }
                      onClick={() => deleteKost(kost.id, kost.name)}
                    >
                      <Trash2 size={15} />
                      {deletingId === kost.id ? "Menghapus..." : "Hapus Kost"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="admin-kost-footer">
          Menampilkan {filteredKosts.length} dari {kosts.length} kost
        </div>
      </section>
    </main>
    </>
  );
}
