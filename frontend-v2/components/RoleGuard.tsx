
"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type Role = "admin" | "owner" | "visitor";

type RoleGuardProps = {
  allowedRoles: Role[];
  children: ReactNode;
};

export default function RoleGuard({
  allowedRoles,
  children,
}: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      if (user.role === "admin") {
        router.replace("/admin");
      } else if (user.role === "owner") {
        router.replace("/owner/dashboard");
      } else {
        router.replace("/");
      }
    }
  }, [user, loading, allowedRoles, router, pathname]);

  if (loading || !user) {
    return <p>Memeriksa hak akses...</p>;
  }

  if (!allowedRoles.includes(user.role)) {
    return <p>Mengarahkan ke halaman yang sesuai...</p>;
  }

  return <>{children}</>;
}
