
"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { formatPrice, type Kost } from "@/lib/kost";
import KostCard from "@/components/KostCard";

export default function KostPage() {
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchKosts() {
      try {
        setLoading(true);
        setError("");

        const data = await apiRequest<Kost[]>("/kosts");
        setKosts(data);
      } catch (err) {
        console.error("Gagal mengambil daftar kost:", err);
        setError("Gagal mengambil data kost. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    }

    fetchKosts();
  }, []);

  const filteredKosts = useMemo(() => {
    return kosts.filter((kost) => {
      const matchesCity = kost.city
        .toLowerCase()
        .includes(city.toLowerCase().trim());

      const matchesPrice =
        !maxPrice || kost.price <= Number(maxPrice);

      return matchesCity && matchesPrice;
    });
  }, [kosts, city, maxPrice]);

  return (
    <>
      <header className="navbar">
        <div className="container navbar-inner">
          <Link href="/" className="logo">
            KostKita.
          </Link>

          <nav className="nav-links">
            <Link href="/">Beranda</Link>
            <Link href="/kost">Cari Kost</Link>
            <Link href="/#tentang">Tentang Kami</Link>
          </nav>

          <div className="nav-actions">
            <Link href="/login" className="btn btn-outline">
              Masuk
            </Link>
            <Link href="/register" className="btn btn-primary">
              Daftar
            </Link>
          </div>
        </div>
      </header>

      <main className="section">
        <div className="container">
          <div className="section-heading">
            <div>
              <h2>Temukan Kost Impianmu</h2>
              <p>
                Cari tempat tinggal sesuai lokasi dan budget kamu.
              </p>
            </div>
          </div>

          <div className="filter-panel">
            <div className="filter-field">
              <label htmlFor="city">Lokasi</label>
              <input
                id="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Cari kota atau daerah..."
              />
            </div>

            <div className="filter-field">
              <label htmlFor="maxPrice">
                Budget maksimal per bulan
              </label>
              <input
                id="maxPrice"
                type="number"
                min="0"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="Contoh: 1500000"
              />
            </div>

            <button
              type="button"
              className="btn btn-outline reset-button"
              onClick={() => {
                setCity("");
                setMaxPrice("");
              }}
            >
              <SlidersHorizontal size={16} />
              Reset
            </button>
          </div>

          <div className="results-heading">
            <div>
              <h3>Daftar Kost</h3>
              {!loading && !error && (
                <p>{filteredKosts.length} kost ditemukan</p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <p>Memuat daftar kost...</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <Search size={32} />
              <h3>Terjadi kesalahan</h3>
              <p>{error}</p>
            </div>
          ) : filteredKosts.length > 0 ? (
            <div className="kost-grid">
              {filteredKosts.map((kost) => (
                <KostCard key={kost.id} kost={kost} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={32} />
              <h3>Kost tidak ditemukan</h3>
              <p>
                Coba ubah lokasi atau budget pencarian kamu.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
