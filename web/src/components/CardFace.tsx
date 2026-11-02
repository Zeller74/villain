import type { Card } from "../protocol";

type CardFaceProps = {
  card: Card;
  locked?: boolean;
  onClick?: () => void;
  canLock?: boolean;
  onToggleLock?: (nextLocked: boolean) => void;
  canAdjustStrength?: boolean;
  onAdjustStrength?: (delta: number) => void;
  size?: "sm" | "md";
  title?: string;
  showCost?: boolean;
};

export function CardFace({
  card,
  locked = false,
  onClick,
  canLock = false,
  onToggleLock,
  canAdjustStrength = false,
  onAdjustStrength,
  size = "md",
  title,
  showCost = true,
}: CardFaceProps) {
  const hasBase = typeof card.baseStrength === "number"; // shows even if 0
  const adjusted = card.strength !== 0;

  // sizing
  const dims =
    size === "sm"
      ? { w: 90, h: 130, font: 10, pad: 6 }
      : { w: 150, h: 200, font: 12, pad: 8 };
  const badgeBase: React.CSSProperties = {
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e5e7eb",
    borderRadius: 6,
    lineHeight: 1,
  };
  const strengthColor =
    card.strength < 0 ? "#fca5a5" : "#a7f3d0";
  const strengthText = card.strength > 0 ? `+${card.strength}` : `${card.strength}`;

  return (
    <div
      onClick={onClick && ((e) => {
        //a card is a target of its own; the zone behind it should not react too
        e.stopPropagation();
        onClick();
      })}
      title={title ?? card.label}
      style={{
        position: "relative",
        width: dims.w,
        height: dims.h,
        padding: dims.pad,
        flexShrink: 0,
        border: "1px solid #475569",
        borderRadius: 8,
        background: "#0b1220",
        color: "#e5e7eb",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        gap: 6,
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
        opacity: locked ? 0.6 : 1,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)",
      }}
    >
      {/* Top-center: card type */}
      {card.type && (
        <div
          style={{
            position: "absolute",
            top: 2,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0 6px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#111827",
            color: "#e5e7eb",
            fontSize: 10,
            lineHeight: 1,
            letterSpacing: 0.5,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
          title={`Type: ${card.type}`}
        >
          {card.type}
        </div>
      )}

      {/* Cost (top-left) */}
      {showCost && card.cost !== null && (
        <div
          style={{
            ...badgeBase,
            position: "absolute",
            top: 2,
            left: 2,
            padding: "0 6px",
            fontSize: 11,
          }}
          title="Cost"
        >
          {card.cost}
        </div>
      )}

      {/* Lock (top-right) */}
      {canLock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.(!locked);
          }}
          title={locked ? "Unlock card" : "Lock card"}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: locked ? "#7f1d1d" : "#1e293b",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
        >
          {locked ? "🔒" : "🔓"}
        </button>
      )}

      {/* Content area: allow wrapping, no ellipsis */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 4,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: dims.font + 1,
            lineHeight: 1.1,
            whiteSpace: "normal",
            overflow: "visible",
            overflowWrap: "anywhere",
          }}
        >
          {card.label}
        </div>

        {card.desc && (
          <div
            style={{
              fontSize: dims.font - 1,
              lineHeight: 1.25,
              opacity: 0.9,
              whiteSpace: "normal",
              overflow: "visible",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {card.desc}
          </div>
        )}
      </div>

      {/* Bottom-left: printed strength */}
      {hasBase && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 4,
            padding: "0 6px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#e5e7eb",
            fontSize: 11,
            lineHeight: 1,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
          title="Printed strength"
        >
          {card.baseStrength}
        </div>
      )}

      {/* Bottom-right: counters are public, even for a player who cannot change them */}
      {!canAdjustStrength && hasBase && adjusted && (
        <div
          style={{
            ...badgeBase,
            position: "absolute",
            bottom: 4,
            right: 4,
            padding: "0 6px",
            fontSize: 11,
            color: strengthColor,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
          title="Current strength"
        >
          {strengthText}
        </div>
      )}

      {/* Bottom-right: compact ± with matching numeric chip */}
      {canAdjustStrength && hasBase && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStrength?.(-1);
            }}
            title="−1 strength"
            style={{
              fontSize: 10,
              height: 20,
              minWidth: 20,
              padding: 0,
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e5e7eb",
              lineHeight: 1,
            }}
          >
            −
          </button>

          {/* matching chip to the left badge */}
          <div
            style={{
              ...badgeBase,
              padding: "0 6px",
              fontSize: 11,
              color: strengthColor,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
            title="Current strength"
          >
            {strengthText}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStrength?.(+1);
            }}
            title="+1 strength"
            style={{
              fontSize: 10,
              height: 20,
              minWidth: 20,
              padding: 0,
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e5e7eb",
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
