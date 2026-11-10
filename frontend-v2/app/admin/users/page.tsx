"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/api";
import Navbar from "@/components/navbar";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "owner" | "visitor";
  created_at: string;
};

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  async function loadUsers() {
    try {
      setError("");
      const data = await apiRequest<AdminUser[]>("/admin/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengguna");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      loadUsers();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user?.role]);

  async function updateRole(id: number, role: AdminUser["role"]) {
    try {
      setSavingId(id);

      await apiRequest(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });

      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengubah role");
    } finally {
      setSavingId(null);
    }
  }

  if (authLoading || loading) {
    return <main className="page-container">Memuat pengguna...</main>;
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
          <h1>Manajemen Pengguna</h1>
          <p>Kelola akun dan hak akses pengguna KostKita.</p>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="admin-user-list">
        {users.map((item) => {
          const isCurrentUser = item.id === user.id;
          const isMainAdmin = item.email === "admin@kostkita.test";

          return (
            <div className="admin-user-card" key={item.id}>
              <div>
                <h3>{item.name}</h3>
                <p>{item.email}</p>
                <small>{item.phone || "Nomor telepon belum tersedia"}</small>
              </div>

              <div className="admin-user-actions">
                <span className={`role-badge role-${item.role}`}>
                  {item.role}
                </span>

                <select
                  value={item.role}
                  disabled={isCurrentUser || isMainAdmin || savingId === item.id}
                  onChange={(e) =>
                    updateRole(item.id, e.target.value as AdminUser["role"])
                  }
                >
                  <option value="visitor">Visitor</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                </select>

                {isMainAdmin && <small>Admin utama</small>}
                {isCurrentUser && <small>Akun Anda</small>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
    </>
  );
}