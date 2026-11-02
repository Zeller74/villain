import type { ReactNode } from "react";

const SHAPES: Record<string, ReactNode> = {
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  trophy: <><path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M9 21l1-3h4l1 3" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  pawn: <path d="M12 2.5a4 4 0 0 1 2.6 7H16v2h-2c.3 3 1.4 5.2 3 7v2.5H7V18.5c1.6-1.8 2.7-4 3-7H8v-2h1.4A4 4 0 0 1 12 2.5Z" />,
  zoom: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8M10.5 7.5v6M7.5 10.5h6" /></>,
};

export function Icon({ name, className = "icon" }: { name: keyof typeof SHAPES; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {SHAPES[name]}
    </svg>
  );
}
