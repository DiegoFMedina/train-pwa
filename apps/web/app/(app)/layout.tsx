"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { AppHeader } from "./_components/app-header";
import { BottomNav } from "./_components/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return null;

  return (
    <>
      <AppHeader />
      {children}
      <BottomNav />
    </>
  );
}
