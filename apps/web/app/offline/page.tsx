export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <div className="max-w-sm text-center">
        <p className="eyebrow mb-3">Sin conexión</p>
        <h1
          className="text-5xl font-light mb-4"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Estás offline
        </h1>
        <p className="text-sm text-[color:var(--color-ink-soft)]">
          Mi Centro vuelve solo cuando recuperes la red. Tus últimas vistas
          siguen disponibles desde el menú.
        </p>
      </div>
    </main>
  );
}
