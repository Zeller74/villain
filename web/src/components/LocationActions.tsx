import type { ActionKind } from "../protocol";

const ACTION_LABELS: Record<ActionKind, string> = {
  gain1: "Gain 1",
  gain2: "Gain 2",
  gain3: "Gain 3",
  play: "Play 1",
  draw2: "Draw 2",
  fate: "Fate",
  discard: "Discard",
  moveItemAlly: "Move Item/Ally",
  moveHero: "Move Hero",
  vanquish: "Vanquish",
  activate: "Activate",
};

export function LocationActions({
  actions,
  topSlots = 0,
  hasTopCover,
  locked,
  isActive, // your turn + viewing self + not locked
}: {
  actions: ActionKind[];
  topSlots?: number;
  hasTopCover: boolean;
  locked?: boolean;
  isActive: boolean;
}) {
  const baseOpacity = locked ? 0.45 : isActive ? 1 : 0.75;


  return (
    <div
      style={{
        margin: "6px 0",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "6px 8px",
        borderRadius: 8,
        background: "#0b1220",
        border: "1px solid #334155",
        opacity: baseOpacity,
      }}
      title={
        locked
          ? "Location locked"
          : isActive
          ? "Available actions on this space"
          : "Actions on this space (view-only)"
      }
    >
      {actions.length === 0 ? (
        <span style={{ fontSize: 12, color: "#94a3b8" }}>No actions</span>
      ) : (
        actions.map((a, idx) => {
        const isTop = idx < topSlots;
        const blocked = hasTopCover && isTop; 

        const border = blocked ? "#7f1d1d" : isTop ? "#9b6c2cff" : "#475569"; // red | amber | slate
        const color  = blocked ? "#f87171" : isTop ? "#ffd770ff" : "#e5e7eb"; // red | amber | light

        return (
          <span
            key={`${a}-${idx}`}
            style={{
              fontSize: 12,
              lineHeight: 1,
              padding: "4px 8px",
              borderRadius: 999,
              border: `1px solid ${border}`,
              background: "#111827",
              color,
              whiteSpace: "nowrap",
            }}
            title={
              blocked
                ? "Top slot blocked by a Hero"
                : isTop
                ? "Top slot (blocked when a Hero is here)"
                : "Bottom slot action"
            }
          >
            {ACTION_LABELS[a]}
          </span>
        );
      })

      )}
      {locked && (
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#fca5a5" }}>🔒 Locked</span>
      )}
    </div>
  );
}
