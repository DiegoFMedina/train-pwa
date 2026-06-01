"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Avatar circular del usuario, integrado al AppHeader. Lleva a /perfil.
 * Oculto en /perfil para evitar redundancia.
 */
export function UserAvatarButton() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();

  if (!user) return null;
  if (pathname?.startsWith("/perfil")) {
    // Spacer para mantener el balance del header
    return <span className="w-9 h-9 block" aria-hidden />;
  }

  const initial = (user.name[0] ?? "?").toUpperCase();

  return (
    <Link
      href="/perfil"
      aria-label={`Abrir perfil de ${user.name}`}
      className="w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-[#1a120a] shadow-md active:scale-95 transition-transform flex-shrink-0"
      style={{
        background:
          "linear-gradient(135deg, var(--color-accent), var(--color-accent-2))",
        fontFamily: "var(--font-serif)",
      }}
    >
      {initial}
    </Link>
  );
}
