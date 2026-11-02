import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicPlayer } from "../protocol";
import type { Call } from "../useGameClient";

const ZOOM = 1.5;

type MenuItem = { label: string; hint: string; needsTurn: boolean; run: () => void };

function btnStyle(enabled: boolean): CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: enabled ? "#e5e7eb" : "#9ca3af",
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

export function PlayerPanel({
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
  const [placeRight, setPlaceRight] = useState(true);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const caretRef = useRef<HTMLButtonElement | null>(null);

  const {characterId} = player;
  const profSrc = `/character/${encodeURIComponent(characterId)}Prof.jpg`;
  const initials = characterName.split(" ").map(s => s[0]?.toUpperCase()).slice(0, 2).join("") || "?";

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const r = menuRef.current.getBoundingClientRect();
    setPlaceRight(window.innerWidth - r.right >= 220);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || caretRef.current?.contains(t)) return;
      setOpen(false);
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
  const items = menus[characterId] ?? [];

  return (
    <div
      style={{
        width: 80,
        minWidth: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ position: "relative" }}>
        {/* Avatar */}
        <div
          title={characterName || "Character"}
          style={{
            width: 64,
            height: 64,
            borderRadius: "999px",
            border: "1px solid #334155",
            background: "#0b1220",
            color: "#e5e7eb",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 18,
            userSelect: "none",
            overflow: "hidden",
          }}
        >
          {failedSrc !== profSrc ? (
            <img
              src={profSrc}
              alt={`${characterName} avatar`}
              draggable={false}
              onError={() => setFailedSrc(profSrc)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                pointerEvents: "none",
                transform: `scale(${ZOOM})`,
                transformOrigin: "center",
              }}
            />
          ) : (
            initials
          )}
        </div>

        {/* Caret/menu trigger (disabled if not viewing self) */}
        <button
          ref={caretRef}
          onClick={() => setOpen(v => !v)}
          disabled={!viewingSelf}
          title={viewingSelf ? "Character actions" : "View your own board to use actions"}
          aria-label="Character actions"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 22,
            height: 22,
            borderRadius: "999px",
            border: "1px solid #334155",
            background: "#111827",
            color: "#e5e7eb",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            opacity: viewingSelf ? 1 : 0.6,
            cursor: viewingSelf ? "pointer" : "default",
            padding: 0,
            transform: open? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </button>

        {/* Popover menu */}
        {open && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              zIndex: 30,
              minWidth: 180,
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#111827",
              color: "#e5e7eb",
              boxShadow: "0 12px 24px rgba(0,0,0,.35)",
              padding: 6,
              ...(placeRight
                ? { top: 0, left: 72 }
                : { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
              ),
            }}
          >
            <div
              style={{
                padding: "6px 8px",
                fontSize: 12,
                opacity: 0.8,
                borderBottom: "1px solid #334155",
                marginBottom: 6,
              }}
            >
              Character actions
            </div>

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
                  style={btnStyle(enabled)}
                >
                  {item.label}
                </button>
              );
            })}

            {items.length === 0 && (
              <button disabled style={btnStyle(false)} title="No character-specific actions yet">
                (No actions available)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tiny caption (wraps if long) */}
      <div
        style={{
          maxWidth: 72,
          textAlign: "center",
          fontSize: 11,
          color: "#cbd5e1",
          wordBreak: "break-word",
        }}
        title={characterName}
      >
        {characterName || "—"}
      </div>

      {/*gothel trust */}
      {characterId === "mother" && (
        <div
          style={{
            width: "100%", border:"1px solid #334155", borderRadius:8, padding:"6px 6px",
            background:"#0b1220", color:"#e5e7eb", display:"flex", flexDirection:"column", gap:6,
          }}
          title="Trust"
        >
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <strong style={{ fontSize:16 }}>Trust: {player.trust}</strong>
          </div>
          {viewingSelf && canAct && (
            <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
              <button style={{width: 30, height: 30, padding: 0, fontSize:15}} onClick={() => call("trust:change", {delta: -1})}>-1</button>
              <button style={{width: 30, height: 30, padding: 0, fontSize:15}} onClick={() => call("trust:change", {delta: +1})}>+1</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
