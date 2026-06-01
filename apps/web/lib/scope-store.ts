import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Scope = "personal" | "couple";

interface ScopeState {
  scope: Scope;
  hasCouple: boolean;
  setScope: (s: Scope) => void;
  setHasCouple: (v: boolean) => void;
}

/**
 * Scope activo persistido en localStorage. Si el user pierde la pareja
 * (la borraron o lo expulsaron), el siguiente refresh detecta hasCouple=false
 * y fuerza scope = "personal".
 */
export const useScopeStore = create<ScopeState>()(
  persist(
    (set) => ({
      scope: "personal",
      hasCouple: false,
      setScope: (scope) => set({ scope }),
      setHasCouple: (hasCouple) =>
        set((prev) => ({
          hasCouple,
          // si pierde la pareja, volver a personal
          scope: hasCouple ? prev.scope : "personal",
        })),
    }),
    {
      name: "mc:scope",
      partialize: (s) => ({ scope: s.scope }),
    },
  ),
);
