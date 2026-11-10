
"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AuthStatus() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Memeriksa login...</p>;
  }

  if (!user) {
    return <p>Kamu belum login.</p>;
  }

  return (
    <div>
      <p>Selamat datang, {user.name}!</p>
      <p>Role: {user.role}</p>
    </div>
  );
}
