
"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, LockKeyhole, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function VisitorRegisterPage() {
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

    const payload = {
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: "visitor",
    };

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.status === "error") {
        throw new Error(result.message || "Registrasi gagal.");
      }

      await refreshUser();

      setMessage("Registrasi berhasil!");

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
        <Link href="/" className="logo auth-logo">KostKita.</Link>

        <section className="auth-card">
          <div className="auth-heading">
            <span className="auth-icon"><User size={24} /></span>
            <h1>Daftar sebagai Visitor</h1>
            <p>Buat akun untuk menemukan kost yang cocok untukmu.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="name">Nama lengkap</label>
              <input
                id="name"
                name="name"
                placeholder="Nama lengkap kamu"
                required
                minLength={2}
                maxLength={100}
              />
            </div>

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
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Lihat password"
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? "Mendaftarkan..." : "Buat Akun Visitor"}
            </button>

            {error && (
              <p className="auth-message" role="alert">{error}</p>
            )}

            {message && (
              <p className="auth-message" role="status">{message}</p>
            )}
          </form>

          <p className="auth-switch">
            Sudah punya akun? <Link href="/login">Masuk</Link>
          </p>

          <p className="auth-switch">
            Ingin mendaftarkan properti?{" "}
            <Link href="/register/owner">Daftar sebagai Owner</Link>
          </p>
        </section>

        <Link href="/register" className="auth-back">
          ← Pilih jenis akun lain
        </Link>
      </div>
    </main>
  );
}
