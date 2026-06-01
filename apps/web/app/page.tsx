"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useOnboardingStore } from "@/lib/onboarding-store";

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const welcomed = useOnboardingStore((s) => s.welcomed);
  const choseCoupleStep = useOnboardingStore((s) => s.choseCoupleStep);

  useEffect(() => {
    if (user) {
      // Si ya autenticado pero no completó el paso solo/pareja, mandarlo ahí.
      // Usuarios existentes que se loguean tienen markAllComplete y caen a /hoy.
      if (!choseCoupleStep) {
        router.replace("/onboarding/solo-o-pareja");
      } else {
        router.replace("/hoy");
      }
    } else {
      router.replace(welcomed ? "/login" : "/bienvenida");
    }
  }, [user, welcomed, choseCoupleStep, router]);

  return null;
}
