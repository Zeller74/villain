import { cx } from "../cx";
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

function chipTitle(isTop: boolean, blocked: boolean) {
  if (blocked) return "Top slot blocked by a Hero";
  return isTop ? "Top slot (blocked when a Hero is here)" : "Bottom slot action";
}

export function LocationActions({
  actions,
  topSlots,
  hasTopCover,
}: {
  actions: ActionKind[];
  topSlots: number;
  hasTopCover: boolean;
}) {
  return (
    <div className="actions">
      {actions.length === 0 && <span className="actions__none">No actions</span>}
      {actions.map((action, idx) => {
        const isTop = idx < topSlots;
        const blocked = hasTopCover && isTop;
        return (
          <span
            key={`${action}-${idx}`}
            className={cx("chip", isTop && "chip--top", blocked && "chip--blocked")}
            title={chipTitle(isTop, blocked)}
          >
            {ACTION_LABELS[action]}
          </span>
        );
      })}
    </div>
  );
}
