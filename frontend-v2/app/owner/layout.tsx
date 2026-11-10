
import { ReactNode } from "react";
import RoleGuard from "@/components/RoleGuard";

export default function OwnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={["owner"]}>
      {children}
    </RoleGuard>
  );
}
