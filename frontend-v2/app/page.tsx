
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import Navbar from "@/components/navbar";
import KostCard from "@/components/KostCard";
import { apiRequest } from "@/lib/api";
import type { Kost } from "@/lib/kost";

export default function KostPage() {
  const [kosts, setKosts] = useState<Kost[]>([]);
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Membaca parameter pencarian dari URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    setCity(params.get("city") ?? "");
    setMaxPrice(params.get("max_price") ?? "");
  }, []);

  // Mengambil data kost dari API
  useEffect(() => {
    async function fetchKosts() {
      try {
        setLoading(true);
        setError("");

        const data = await apiRequest<Kost[]>("/kosts");
        setKosts(data ?? []);
      } catch (err) {
        console.error("Gagal mengambil data kost:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data kost."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchKosts();
  }, []);

  // Filter data kost berdasarkan kota dan budget
  const filteredKosts = useMemo(() => {
    return kosts.filter((kost) => {
      const cityMatch = city.trim()
        ? kost.city.toLowerCase().includes(city.trim().toLowerCase())
        : true;

      const priceMatch = maxPrice
        ? kost.price <= Number(maxPrice)
        : true;

      return cityMatch && priceMatch;
    });
  }, [kosts, city, maxPrice]);

  // Memperbarui URL saat pencarian dilakukan
  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();

    if (city.trim()) {
      params.set("city", city.trim());
    }

    if (maxPrice) {
      params.set("max_price", maxPrice);
    }

    const query = params.toString();

    window.history.replaceState(
      null,
      "",
      query ? `/kost?${query}` : "/kost"
    );
  }

  function handleReset() {
    setCity("");
    setMaxPrice("");
    window.history.replaceState(null, "", "/kost");
  }

  return (
    <>
      <Navbar />

      <main>
        <section className="section">
          <div className="container">
            <div className="section-heading">
              <div>
                <h2>Cari Kost</h2>
                <p>
                  Temukan kost yang sesuai dengan lokasi dan budget kamu.
                </p>
              </div>
            </div>

            <form
              className="search-panel"
              onSubmit={handleSearch}
            >
              <div className="search-field">
                <label htmlFor="city">Lokasi</label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Masukkan kota atau daerah"
                />
              </div>

              <div className="search-field">
                <label htmlFor="max_price">
                  Budget maksimal
                </label>
                <input
                  id="max_price"
                  type="number"
                  min="0"
                  value={maxPrice}
                  onChange={(event) =>
                    setMaxPrice(event.target.value)
                  }
                  placeholder="Contoh: 1500000"
                />
              </div>

              <button
                className="btn btn-primary"
                type="submit"
              >
                <Search size={16} />
                Cari Kost
              </button>
            </form>

            <div className="section-heading">
              <div>
                <h2>Hasil Pencarian</h2>
                <p>
                  {loading
                    ? "Sedang mengambil data kost..."
                    : `${filteredKosts.length} kost ditemukan`}
                </p>
              </div>

              <button
                type="button"
                className="btn"
                onClick={handleReset}
              >
                <SlidersHorizontal size={16} />
                Reset Filter
              </button>
            </div>

            {loading ? (
              <p>Memuat daftar kost...</p>
            ) : error ? (
              <p>{error}</p>
            ) : filteredKosts.length > 0 ? (
              <div className="kost-grid">
                {filteredKosts.map((kost) => (
                  <KostCard
                    key={kost.id}
                    kost={kost}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>Kost tidak ditemukan</h3>
                <p>
                  Coba ubah lokasi atau naikkan budget pencarian kamu.
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleReset}
                >
                  Tampilkan Semua Kost
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
