
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiRequest } from "@/lib/api";
import {
  Wifi,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";

type Facility = {
  id: number;
  name: string;
};

export default function AdminFacilitiesPage() {
  const { user, loading: authLoading } = useAuth();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadFacilities() {
    try {
      setError("");
      const data = await apiRequest<Facility[]>("/admin/facilities");
      setFacilities(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memuat fasilitas"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      loadFacilities();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, user?.role]);

  async function addFacility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setError("Nama fasilitas wajib diisi.");
      return;
    }

    const duplicate = facilities.some(
      (facility) =>
        facility.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      setError("Fasilitas tersebut sudah tersedia.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await apiRequest("/admin/facilities", {
        method: "POST",
        body: JSON.stringify({ name: cleanName }),
      });

      setName("");
      setSuccess("Fasilitas berhasil ditambahkan.");
      await loadFacilities();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menambahkan fasilitas"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteFacility(facility: Facility) {
    const confirmed = window.confirm(
      `Yakin ingin menghapus fasilitas "${facility.name}"?`
    );

    if (!confirmed) return;

    try {
      setDeletingId(facility.id);
      setError("");
      setSuccess("");

      await apiRequest(`/admin/facilities/${facility.id}`, {
        method: "DELETE",
      });

      setFacilities((previous) =>
        previous.filter((item) => item.id !== facility.id)
      );

      setSuccess("Fasilitas berhasil dihapus.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menghapus fasilitas"
      );
    } finally {
      setDeletingId(null);
    }
  }

  if (authLoading || loading) {
    return <main className="page-container">Memuat fasilitas...</main>;
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
          <h1>Manajemen Fasilitas</h1>
          <p>
            Kelola daftar fasilitas yang dapat dipilih oleh pemilik kost.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={loadFacilities}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
      {success && <p className="admin-facility-success">{success}</p>}

      <section className="admin-facility-summary">
        <div className="admin-facility-summary-icon">
          <Wifi size={25} />
        </div>
        <div>
          <span>Total Fasilitas</span>
          <strong>{facilities.length}</strong>
        </div>
      </section>

      <section className="admin-facility-panel">
        <h2>Tambah Fasilitas</h2>
        <p>Tambahkan fasilitas baru ke dalam pilihan listing kost.</p>

        <form onSubmit={addFacility} className="admin-facility-form">
          <input
            type="text"
            placeholder="Contoh: WiFi, AC, Parkir Motor..."
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
          />

          <button type="submit" disabled={saving}>
            <Plus size={17} />
            {saving ? "Menyimpan..." : "Tambah"}
          </button>
        </form>
      </section>

      <section className="admin-facility-panel">
        <div className="admin-facility-list-heading">
          <div>
            <h2>Daftar Fasilitas</h2>
            <p>Fasilitas yang tersedia di platform KostKita.</p>
          </div>
          <span>{facilities.length} fasilitas</span>
        </div>

        {facilities.length === 0 ? (
          <div className="admin-facility-empty">
            <Wifi size={35} />
            <h3>Belum ada fasilitas</h3>
            <p>Tambahkan fasilitas pertama melalui formulir di atas.</p>
          </div>
        ) : (
          <div className="admin-facility-list">
            {facilities.map((facility) => (
              <div className="admin-facility-item" key={facility.id}>
                <div className="admin-facility-item-icon">
                  <CheckCircle size={18} />
                </div>

                <div className="admin-facility-item-info">
                  <strong>{facility.name}</strong>
                  <span>ID fasilitas: #{facility.id}</span>
                </div>

                <button
                  type="button"
                  className="admin-facility-delete"
                  disabled={deletingId === facility.id}
                  onClick={() => deleteFacility(facility)}
                >
                  <Trash2 size={16} />
                  {deletingId === facility.id ? "Menghapus..." : "Hapus"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
    </>
  );
}
