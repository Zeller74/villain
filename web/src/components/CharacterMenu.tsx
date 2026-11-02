import { useEffect, useRef, useState } from "react";
import { cx } from "../cx";
import type { PublicPlayer } from "../protocol";
import type { Call } from "../useGameClient";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

type MenuItem = { label: string; hint: string; needsTurn: boolean; run: () => void };

//the villain's portrait, which opens the actions only that villain has
export function CharacterMenu({
  player,
  characterName,
  viewingSelf,
  canAct,
  call,
  onError,
}: {
  player: PublicPlayer;
  characterName: string;
  viewingSelf: boolean;
  canAct: boolean;
  call: Call;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const peek = (count: number, reshuffleFirst = false) =>
    call("fatePeek:start", {targetId: player.id, count, reshuffleFirst});

  const findHero = () => call("fateFindHero:start", {targetId: player.id}, (res) => {
    if (!res.found) onError(`No hero found in ${res.targetName}’s fate deck.`);
  });

  const menus: Record<string, MenuItem[]> = {
    lotso: [
      {label: "Flip Buzz", hint: "Flip Buzz ↔ Demo Mode Buzz at the same location", needsTurn: true, run: () => call("lotso:flipBuzz", {})},
      {label: "Find Hero", hint: "Reveal fate cards until a Hero is found", needsTurn: true, run: findHero},
    ],
    lady: [
      {label: "Invitation From the King", hint: "Look at top 2 fate cards, discard 1, keep 1 on top", needsTurn: true, run: () => call("fateSift:start", {})},
      {label: "I Never Go Back On My Word", hint: "Shuffle fate discard into fate deck, then peek top 4 and reorder", needsTurn: true, run: () => peek(4, true)},
    ],
    captain: [
      {label: "Give Them a Scare", hint: "Look at the top 2 cards of your Fate deck and reorder them", needsTurn: true, run: () => peek(2)},
      {label: "Find Hero…", hint: "Reveal fate cards until a Hero is found", needsTurn: true, run: findHero},
    ],
    maleficent: [
      {label: player.handPublic ? "Hide Hand" : "Reveal Hand", hint: "Toggle whether your hand is visible to others", needsTurn: false, run: () => call("char:toggleHandReveal", {})},
    ],
  };
  const items = menus[player.characterId] ?? [];

  return (
    <div className="character-menu" ref={rootRef}>
      <Avatar characterId={player.characterId} name={characterName} />

      <button
        className={cx("character-menu__caret", open && "is-open")}
        onClick={() => setOpen(v => !v)}
        disabled={!viewingSelf}
        title={viewingSelf ? "Character actions" : "View your own board to use actions"}
        aria-label="Character actions"
      >
        <Icon name="chevron" />
      </button>

      {open && (
        <div className="character-menu__list frame">
          <span className="label">Character actions</span>

          {items.map((item) => {
            const enabled = viewingSelf && (canAct || !item.needsTurn);
            return (
              <button
                key={item.label}
                onClick={() => {
                  setOpen(false);
                  item.run();
                }}
                disabled={!enabled}
                title={!viewingSelf ? "View your own board to use actions" : (enabled ? item.hint : "Your turn required")}
              >
                {item.label}
              </button>
            );
          })}

          {items.length === 0 && (
            <button disabled title="No character-specific actions yet">
              (No actions available)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
