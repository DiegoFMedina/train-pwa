import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado de onboarding del usuario. Persistido en localStorage.
 *
 * Si el usuario hace "Crear cuenta", se inicializa todo en false y se
 * dispara el flujo guiado. Si hace "Entrar" (cuenta existente), se
 * setea todo en true y se salta el onboarding completo.
 *
 * Pierdes el estado al cambiar de dispositivo. Para uso personal de
 * Diego es aceptable — el onboarding completo se ve solo en su iPhone
 * vs su laptop, no es bug.
 */
interface OnboardingState {
  welcomed: boolean; // vio /bienvenida
  registered: boolean; // completó /login (registro)
  choseCoupleStep: boolean; // pasó el paso solo/pareja
  finished: boolean; // vio /onboarding/listo
  // Persistentes secundarios:
  dismissedCoupleBanner: boolean;
  seenScopeTooltip: boolean;

  setFlag: (k: keyof OnboardingState, v: boolean) => void;
  markAllComplete: () => void; // para login de cuenta existente
  reset: () => void;
}

const defaults = {
  welcomed: false,
  registered: false,
  choseCoupleStep: false,
  finished: false,
  dismissedCoupleBanner: false,
  seenScopeTooltip: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...defaults,
      setFlag: (k, v) => set({ [k]: v } as Partial<OnboardingState>),
      markAllComplete: () =>
        set({
          welcomed: true,
          registered: true,
          choseCoupleStep: true,
          finished: true,
        }),
      reset: () => set(defaults),
    }),
    { name: "mc:onb" },
  ),
);
