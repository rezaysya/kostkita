
"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);

    const email = formData.get("email");
    const password = formData.get("password");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok || result.status === "error") {
        throw new Error(result.message || "Email atau password salah.");
      }

      const user = result.data.user;

setMessage(`Login berhasil. Selamat datang, ${user.name}!`);

// Update authentication state
await refreshUser();

// Redirect setelah state user diperbarui
router.push("/");
router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <Link href="/" className="logo auth-logo">
          KostKita.
        </Link>

        <section className="auth-card">
          <div className="auth-heading">
            <span className="auth-icon">
              <LockKeyhole size={24} />
            </span>
            <h1>Selamat Datang Kembali</h1>
            <p>Masuk ke akun KostKita untuk melanjutkan.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <Mail size={18} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="nama@email.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <LockKeyhole size={18} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Lihat password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>

            {error && (
              <p className="auth-message" role="alert">
                {error}
              </p>
            )}

            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}
          </form>

          <p className="auth-switch">
            Belum punya akun? <Link href="/register">Daftar sekarang</Link>
          </p>
        </section>

        <Link href="/" className="auth-back">
          ← Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
