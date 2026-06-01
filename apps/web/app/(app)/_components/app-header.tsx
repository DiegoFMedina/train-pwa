"use client";

import { ScopeSwitcher } from "./scope-switcher";
import { UserAvatarButton } from "./user-avatar-button";

/**
 * Header sticky superior con backdrop blur. Contiene el ScopeSwitcher
 * (visible si hay pareja) y el UserAvatarButton.
 *
 * Estrategia robusta vs un pill "fixed top-center":
 *   - Respeta env(safe-area-inset-top) con padding-top.
 *   - Sticky: el contenido scrollea debajo sin tapar el header.
 *   - Funciona igual en iPhones con notch tradicional (10-13),
 *     Dynamic Island (14 Pro+), Android, y desktop.
 */
export function AppHeader() {
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-xl bg-[color:var(--color-bg)]/65 border-b border-[color:var(--color-line)]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto max-w-md px-4 h-12 flex items-center justify-between gap-2">
        {/* Izquierda: switcher (o spacer si no hay pareja) */}
        <div className="flex-1 min-w-0 flex justify-start">
          <ScopeSwitcher />
        </div>

        {/* Derecha: avatar */}
        <UserAvatarButton />
      </div>
    </header>
  );
}
