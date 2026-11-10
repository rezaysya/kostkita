
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";

export default function Navbar() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Logout gagal");

      await refreshUser();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat logout.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="navbar">
      <div className="container navbar-container">
        <Link href="/" className="logo">
          KostKita.
        </Link>

        <div className="nav-links">
          <Link href="/">Beranda</Link>
          <Link href="/kost">Cari Kost</Link>
          <Link href="/#tentang">Tentang Kami</Link>

          {user?.role === "visitor" && (
            <Link href="/favorites">Favorit</Link>
          )}

          {user?.role === "owner" && (
            <Link href="/owner/dashboard">Dashboard Owner</Link>
          )}

          {user?.role === "admin" && (
            <>
              <Link href="/admin">Dashboard Admin</Link>
              <Link href="/admin/users">Pengguna</Link>
              <Link href="/admin/kosts">Kelola Kost</Link>
              <Link href="/admin/facilities">Fasilitas</Link>
            </>
          )}
        </div>

        <div className="nav-actions">
          {loading ? (
            <span>Memuat...</span>
          ) : user ? (
            <>
              <span className="navbar-greeting">
                Halo, <strong>{user.name}</strong>
              </span>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="btn btn-primary"
              >
                {loggingOut ? "Keluar..." : "Keluar"}
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline">
                Masuk
              </Link>

              <Link href="/register" className="btn btn-primary">
                Daftar
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
