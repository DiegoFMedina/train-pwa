interface ComingSoonProps {
  title: string;
  phase: string;
  description: string;
}

export function ComingSoon({ title, phase, description }: ComingSoonProps) {
  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-32">
      <header className="mb-8">
        <p className="eyebrow mb-1.5">{phase}</p>
        <h1 className="text-5xl font-light" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h1>
      </header>
      <div className="card text-center py-10">
        <p className="text-3xl mb-3" aria-hidden>
          ✦
        </p>
        <p className="text-sm text-[color:var(--color-ink-soft)] max-w-[28ch] mx-auto">
          {description}
        </p>
      </div>
    </main>
  );
}
