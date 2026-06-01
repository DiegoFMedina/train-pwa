import type { ReactNode } from "react";

type Variant = "money" | "routine" | "dish" | "calendar" | "generic";

interface EmptyStateProps {
  variant?: Variant;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  variant = "generic",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-10 px-6">
      <div className="mx-auto mb-4 w-16 h-16 grid place-items-center">
        <Illustration variant={variant} />
      </div>
      <p className="font-medium mb-1">{title}</p>
      {description && (
        <p className="text-xs text-[color:var(--color-ink-faint)] max-w-[28ch] mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function Illustration({ variant }: { variant: Variant }) {
  const common = {
    viewBox: "0 0 64 64",
    fill: "none",
    className: "w-full h-full",
    "aria-hidden": true,
  } as const;
  const stroke = "color-mix(in oklab, var(--color-accent) 70%, transparent)";
  const fill = "color-mix(in oklab, var(--color-accent) 14%, transparent)";

  switch (variant) {
    case "money":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill={fill} />
          <circle
            cx="32"
            cy="32"
            r="22"
            stroke={stroke}
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <path
            d="M32 20v24M26 26h9a3 3 0 010 6h-6a3 3 0 000 6h9"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "routine":
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill={fill} />
          <circle cx="32" cy="32" r="22" stroke={stroke} strokeWidth="1.5" />
          <path
            d="M22 32l7 7L42 24"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "dish":
      return (
        <svg {...common}>
          <ellipse cx="32" cy="38" rx="22" ry="8" fill={fill} />
          <ellipse
            cx="32"
            cy="38"
            rx="22"
            ry="8"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path
            d="M14 38c0-10 8-16 18-16s18 6 18 16"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M28 22v-6M32 22v-8M36 22v-6"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect
            x="12"
            y="16"
            width="40"
            height="36"
            rx="6"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path
            d="M12 26h40"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <path
            d="M22 12v8M42 12v8"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="22" cy="36" r="2" fill="var(--color-accent)" />
          <circle cx="32" cy="36" r="2" fill={stroke} />
          <circle cx="42" cy="36" r="2" fill={stroke} />
          <circle cx="22" cy="44" r="2" fill={stroke} />
        </svg>
      );
    case "generic":
    default:
      return (
        <svg {...common}>
          <circle cx="32" cy="32" r="22" fill={fill} />
          <circle cx="32" cy="32" r="22" stroke={stroke} strokeWidth="1.5" />
          <path
            d="M28 28h8M28 32h8M28 36h5"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
