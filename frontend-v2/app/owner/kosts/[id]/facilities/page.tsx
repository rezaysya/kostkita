
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Wifi, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

type Facility = {
  id: number;
  name: string;
  created_at?: string;
};

export default function ManageFacilitiesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [kostName, setKostName] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user || user.role !== "owner") {
      router.replace("/login");
      return;
    }

    async function loadData() {
      try {
        setLoadingData(true);
        setError("");

        const [facilityResponse, kostResponse] = await Promise.all([
          fetch("/api/facilities", { cache: "no-store" }),
          fetch(`/api/owner/kosts/${id}`, { cache: "no-store" }),
        ]);

        const facilityResult = await facilityResponse.json();
        const kostResult = await kostResponse.json();

        if (!facilityResponse.ok || facilityResult.status !== "success") {
          throw new Error("Gagal mengambil daftar fasilitas.");
        }

        if (!kostResponse.ok || kostResult.status !== "success") {
          throw new Error("Gagal mengambil data kost.");
        }

        const facilityList = facilityResult.data ?? [];
        const kost = kostResult.data;

        setFacilities(facilityList);
        setKostName(kost.name ?? "");

        // Ambil ID fasilitas yang sudah dimiliki kost.
        const existingFacilities = kost.facilities ?? [];

        setSelectedIds(
          existingFacilities.map((facility: Facility | number) =>
            typeof facility === "number" ? facility : facility.id
          )
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Terjadi kesalahan."
        );
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, [id, user, loading, router]);

  function toggleFacility(facilityId: number) {
    setSelectedIds((current) =>
      current.includes(facilityId)
        ? current.filter((id) => id !== facilityId)
        : [...current, facilityId]
    );

    setSuccess("");
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/owner/kosts/${id}/facilities`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            facility_ids: selectedIds,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(
          result.error?.message || "Gagal menyimpan fasilitas."
        );
      }

      setSuccess("Fasilitas kost berhasil disimpan!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingData) {
    return <div className="owner-dashboard">Memuat fasilitas...</div>;
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
        <h1>Kelola Fasilitas Kost</h1>
        <p>
          Pilih fasilitas yang tersedia di{" "}
          <strong>{kostName}</strong>.
        </p>
      </div>

      <section className="create-kost-form">
        <div className="kost-image-heading">
          <h2>Daftar Fasilitas</h2>
          <span>{selectedIds.length} dipilih</span>
        </div>

        {error && (
          <div className="create-form-error">{error}</div>
        )}

        {success && (
          <p className="kost-image-success">{success}</p>
        )}

        {facilities.length === 0 ? (
          <p>Belum ada fasilitas yang tersedia.</p>
        ) : (
          <div className="facility-grid">
            {facilities.map((facility) => {
              const checked = selectedIds.includes(facility.id);

              return (
                <label
                  key={facility.id}
                  className={`facility-option ${
                    checked ? "selected" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFacility(facility.id)}
                  />

                  <span className="facility-option-icon">
                    {checked ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <Wifi size={20} />
                    )}
                  </span>

                  <span>{facility.name}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className="create-form-actions">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="create-submit-button"
          >
            <Save size={18} />
            {saving ? "Menyimpan..." : "Simpan Fasilitas"}
          </button>
        </div>
      </section>
    </main>
  );
}
