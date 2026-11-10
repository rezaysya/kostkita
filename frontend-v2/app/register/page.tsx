
import Link from "next/link";
import { ArrowRight, Search, Building2 } from "lucide-react";

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <div className="auth-container auth-container-wide">
        <Link href="/" className="logo auth-logo">KostKita.</Link>

        <section className="auth-card">
          <div className="auth-heading">
            <h1>Bergabung dengan KostKita</h1>
            <p>Pilih jenis akun yang sesuai dengan kebutuhanmu.</p>
          </div>

          <div className="role-options">
            <Link href="/register/visitor" className="role-card">
              <span className="role-icon"><Search size={25} /></span>
              <div>
                <h2>Saya mencari kost</h2>
                <p>Temukan kost yang nyaman dan sesuai budget.</p>
              </div>
              <ArrowRight size={20} />
            </Link>

            <Link href="/register/owner" className="role-card">
              <span className="role-icon"><Building2 size={25} /></span>
              <div>
                <h2>Saya pemilik kost</h2>
                <p>Kelola dan promosikan properti kost milikmu.</p>
              </div>
              <ArrowRight size={20} />
            </Link>
          </div>

          <p className="auth-switch">
            Sudah punya akun? <Link href="/login">Masuk</Link>
          </p>
        </section>

        <Link href="/" className="auth-back">← Kembali ke beranda</Link>
      </div>
    </main>
  );
}
