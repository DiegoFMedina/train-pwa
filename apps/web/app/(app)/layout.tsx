"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { BottomNav } from "./_components/bottom-nav";
import { ScopeSwitcher } from "./_components/scope-switcher";
import { UserAvatarButton } from "./_components/user-avatar-button";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <>
      <ScopeSwitcher />
      <UserAvatarButton />
      {children}
      <BottomNav />
    </>
  );
}
