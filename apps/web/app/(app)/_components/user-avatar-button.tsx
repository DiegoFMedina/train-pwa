"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";

export function UserAvatarButton() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();

  if (!user) return null;
  // En la propia pantalla de perfil no mostramos el avatar (redundante).
  if (pathname?.startsWith("/perfil")) return null;

  const initial = (user.name[0] ?? "?").toUpperCase();

  return (
    <Link
      href="/perfil"
      aria-label={`Abrir perfil de ${user.name}`}
      className="fixed z-30 top-[calc(env(safe-area-inset-top,0)+12px)] right-4 w-9 h-9 rounded-full grid place-items-center text-sm font-bold text-[#1a120a] shadow-lg active:scale-95 transition-transform"
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
