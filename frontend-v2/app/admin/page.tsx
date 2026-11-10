
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/api";
import {
  Users,
  Building2,
  UserRound,
  CheckCircle,
  Clock,
  Archive,
  ArrowRight,
  MapPin,
  RefreshCw,
} from "lucide-react";
import Navbar from "@/components/navbar";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "owner" | "visitor";
  created_at: string;
};

type AdminKost = {
  id: number;
  name: string;
  city: string;
  province: string;
  price: number;
  status: "draft" | "published" | "archived";
  owner: {
    name: string;
    phone: string | null;
  };
  created_at: string;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [kosts, setKosts] = useState<AdminKost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setError("");

      const [userData, kostData] = await Promise.all([
        apiRequest<AdminUser[]>("/admin/users"),
        apiRequest<AdminKost[]>("/admin/kosts"),
      ]);

      setUsers(userData);
      setKosts(kostData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data dashboard"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      loadDashboard();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user?.role]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    totalOwners: users.filter((item) => item.role === "owner").length,
    totalVisitors: users.filter((item) => item.role === "visitor").length,
    totalAdmins: users.filter((item) => item.role === "admin").length,
    totalKosts: kosts.length,
    published: kosts.filter((item) => item.status === "published").length,
    draft: kosts.filter((item) => item.status === "draft").length,
    archived: kosts.filter((item) => item.status === "archived").length,
  }), [users, kosts]);

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [users]
  );

  const recentKosts = useMemo(
    () =>
      [...kosts]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )
        .slice(0, 5),
    [kosts]
  );

  if (authLoading || loading) {
    return <main className="page-container">Memuat dashboard...</main>;
  }

  if (user?.role !== "admin") {
    return <main className="page-container">Akses hanya untuk admin.</main>;
  }

  return (
    <>
    <Navbar />
    <main className="page-container">
      <div className="page-header admin-dashboard-header">
        <div>
          <h1>Dashboard Admin</h1>
          <p>
            Selamat datang, {user.name}. Pantau aktivitas KostKita di sini.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={loadDashboard}
        >
          <RefreshCw size={16} />
          Refresh Data
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      <section className="admin-dashboard-stats">
        <div className="admin-dashboard-stat">
          <div className="admin-stat-icon purple">
            <Users size={22} />
          </div>
          <div>
            <span>Total Pengguna</span>
            <strong>{stats.totalUsers}</strong>
            <small>{stats.totalAdmins} admin terdaftar</small>
          </div>
        </div>

        <div className="admin-dashboard-stat">
          <div className="admin-stat-icon blue">
            <Building2 size={22} />
          </div>
          <div>
            <span>Total Kost</span>
            <strong>{stats.totalKosts}</strong>
            <small>Semua listing kost</small>
          </div>
        </div>

        <div className="admin-dashboard-stat">
          <div className="admin-stat-icon green">
            <UserRound size={22} />
          </div>
          <div>
            <span>Total Owner</span>
            <strong>{stats.totalOwners}</strong>
            <small>{stats.totalVisitors} visitor</small>
          </div>
        </div>

        <div className="admin-dashboard-stat">
          <div className="admin-stat-icon emerald">
            <CheckCircle size={22} />
          </div>
          <div>
            <span>Kost Published</span>
            <strong>{stats.published}</strong>
            <small>Listing aktif</small>
          </div>
        </div>
      </section>

      <section className="admin-status-section">
        <div className="admin-section-heading">
          <div>
            <h2>Status Listing</h2>
            <p>Ringkasan kondisi seluruh listing kost.</p>
          </div>

          <Link href="/admin/kosts">
            Kelola Kost <ArrowRight size={15} />
          </Link>
        </div>

        <div className="admin-status-grid">
          <div className="admin-status-card">
            <Clock size={21} />
            <div>
              <strong>{stats.draft}</strong>
              <span>Draft</span>
            </div>
          </div>

          <div className="admin-status-card">
            <CheckCircle size={21} />
            <div>
              <strong>{stats.published}</strong>
              <span>Published</span>
            </div>
          </div>

          <div className="admin-status-card">
            <Archive size={21} />
            <div>
              <strong>{stats.archived}</strong>
              <span>Archived</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-quick-actions">
        <h2>Akses Cepat</h2>

        <div className="admin-quick-grid">
          <Link href="/admin/users" className="admin-quick-card">
            <Users size={22} />
            <div>
              <strong>Kelola Pengguna</strong>
              <span>Atur akun dan role pengguna</span>
            </div>
            <ArrowRight size={18} />
          </Link>

          <Link href="/admin/kosts" className="admin-quick-card">
            <Building2 size={22} />
            <div>
              <strong>Kelola Kost</strong>
              <span>Moderasi semua listing kost</span>
            </div>
            <ArrowRight size={18} />
          </Link>

          <Link href="/admin/facilities" className="admin-quick-card">
            <CheckCircle size={22} />
            <div>
              <strong>Kelola Fasilitas</strong>
              <span>Atur fasilitas yang tersedia</span>
            </div>
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <section className="admin-recent-grid">
        <div className="admin-recent-panel">
          <div className="admin-section-heading">
            <h2>Pengguna Terbaru</h2>
            <Link href="/admin/users">Lihat Semua</Link>
          </div>

          {recentUsers.length === 0 ? (
            <p className="admin-empty-text">Belum ada pengguna.</p>
          ) : (
            recentUsers.map((item) => (
              <div className="admin-recent-item" key={item.id}>
                <div className="admin-recent-avatar">
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="admin-recent-info">
                  <strong>{item.name}</strong>
                  <span>{item.email}</span>
                </div>
                <span className={`role-badge role-${item.role}`}>
                  {item.role}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="admin-recent-panel">
          <div className="admin-section-heading">
            <h2>Kost Terbaru</h2>
            <Link href="/admin/kosts">Lihat Semua</Link>
          </div>

          {recentKosts.length === 0 ? (
            <p className="admin-empty-text">Belum ada kost.</p>
          ) : (
            recentKosts.map((item) => (
              <div className="admin-recent-item" key={item.id}>
                <div className="admin-recent-avatar">
                  <Building2 size={18} />
                </div>

                <div className="admin-recent-info">
                  <strong>{item.name}</strong>
                  <span>
                    <MapPin size={12} />
                    {item.city} · {formatPrice(item.price)}
                  </span>
                  <small>
                    {item.owner?.name || "Pemilik tidak diketahui"} ·{" "}
                    {formatDate(item.created_at)}
                  </small>
                </div>

                <span
                  className={`kost-status-badge status-${item.status}`}
                >
                  {item.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
    </>
  );
}
