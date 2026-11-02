import type { CSSProperties } from "react";

export const panel: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 12,
  background: "#111827",
  color: "#e5e7eb",
};

export const raisedPanel: CSSProperties = {
  ...panel,
  background: "#1f2937",
};
