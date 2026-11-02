import type { Card, LocationIndex, PublicPlayer } from "../protocol";
import { CardFace } from "./CardFace";
import { LocationActions } from "./LocationActions";

export type BoardHandlers = {
  onPawn: (i: LocationIndex) => void;
  onToggleLocationLock: (i: LocationIndex, locked: boolean) => void;
  onToggleCardLock: (card: Card, locked: boolean) => void;
  onAdjustStrength: (card: Card, delta: number) => void;
  onTopZone: (i: LocationIndex) => void;
  onTopCard: (card: Card, i: LocationIndex) => void;
  onBottomZone: (i: LocationIndex) => void;
  onBottomCard: (card: Card, i: LocationIndex) => void;
};

type BoardProps = BoardHandlers & {
  player: PublicPlayer;
  viewingSelf: boolean;
  canAct: boolean;
  canEdit: boolean; //strength and locks on your own cards, whoever's turn it is
  placingFate: boolean;
  movingRow: "top" | "bottom" | null;
  selectedCount: number;
};

function bottomTitle({viewingSelf, canAct, locked, moving, selectedCount}: {viewingSelf: boolean; canAct: boolean; locked: boolean; moving: boolean; selectedCount: number}) {
  if (!viewingSelf) return "You can only play on your own board";
  if (!canAct) return "Not your turn";
  if (locked) return "Location is locked";
  if (moving) return "Click to drop the moving card";
  return selectedCount === 1 ? "Click to play the selected card here" : "Select exactly one card";
}

export function Board(props: BoardProps) {
  const {player, viewingSelf, canAct, canEdit, placingFate, movingRow, selectedCount} = props;
  const canSetPawn = viewingSelf && canAct;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {player.board.locations.map((loc, index) => {
        const i = index as LocationIndex;
        const isPawnHere = player.board.moverAt === i;
        const dropping = movingRow === "bottom" || (viewingSelf && canAct && selectedCount === 1);

        return (
          <div
            key={loc.id}
            style={{
              border: "1px solid #475569",
              borderRadius: 10,
              padding: 10,
              background: "#0f172a",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: canSetPawn ? "pointer" : "default",
                color: isPawnHere ? "#facc15" : undefined, // highlight pawn row
              }}
              title={
                isPawnHere ? "Pawn is here"
                : canSetPawn ? "Click to move pawn here"
                : undefined
              }
              onClick={() => { if (canSetPawn) props.onPawn(i); }}
            >
              {/* tiny pawn dot when active */}
              {isPawnHere && <span style={{ fontSize: 12 }}>●</span>}
              <span>{loc.name}{loc.locked ? "🔒" : ""}</span>
              {canSetPawn && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleLocationLock(i, !loc.locked);
                  }}
                  title={loc.locked ? "Unlock this location" : "Lock this location"}
                  style={{
                    marginLeft: "auto",
                    fontSize: 12, padding: "2px 6px",
                    borderRadius: 6, border: "1px solid #334155",
                    background: loc.locked ? "#7f1d1d" : "#1e293b",
                    color: "#e5e7eb",
                    cursor: "pointer",
                  }}
                >
                  {loc.locked ? "Unlock" : "Lock"}
                </button>
              )}
            </div>

            {/* Top (public) */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Top</div>
              <div
                data-testid={`top-${i}`}
                onClick={() => props.onTopZone(i)}
                title={placingFate ? "Click to place fate card here (Top)" : undefined}
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  border: (placingFate || movingRow === "top") ? "1px dashed #3b82f6" : "1px solid #475569",
                  borderRadius: 8,
                  padding: 6,
                  cursor: (placingFate || movingRow === "top") ? "pointer" : "default",
                  background: "#111827",
                  minHeight: 220,
                }}
              >
                {loc.top.length === 0 ? (
                  <span style={{ opacity: 0.6, fontSize: 12 }}>empty</span>
                ) : (
                  loc.top.map((c) => (
                    <CardFace
                      key={c.id}
                      card={c}
                      showCost={false}
                      locked={c.locked}
                      onClick={() => props.onTopCard(c, i)}
                      canLock={canEdit}
                      onToggleLock={(next) => props.onToggleCardLock(c, next)}
                      canAdjustStrength={canEdit && !c.locked}
                      onAdjustStrength={(delta) => props.onAdjustStrength(c, delta)}
                      size="md"
                    />
                  ))
                )}
              </div>
            </div>

            {/*Location actions */}
            <LocationActions
              actions={loc.actions}
              topSlots={loc.topSlots}
              hasTopCover={loc.top.length > 0}
              locked={loc.locked}
              isActive={viewingSelf && canAct && !loc.locked}
            />

            {/* Bottom (your plays) */}
            <div style={{ fontSize: 12, opacity: 0.7 }}>Bottom</div>
            <div
              data-testid={`bottom-${i}`}
              onClick={() => props.onBottomZone(i)}
              style={{
                border: dropping ? "1px dashed #3b82f6" : "1px solid #475569",
                borderRadius: 8,
                padding: 6,
                background: "#111827",
                cursor: dropping ? "pointer" : "default",
                minHeight: 220,
              }}
              title={bottomTitle({viewingSelf, canAct, locked: loc.locked, moving: movingRow === "bottom", selectedCount})}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {loc.bottom.length === 0 ? (
                  <span style={{ opacity: 0.6, fontSize: 12 }}>empty</span>
                ) : (
                  loc.bottom.map(c => (
                    <CardFace
                      key={c.id}
                      card={c}
                      locked={c.locked}
                      onClick={() => props.onBottomCard(c, i)}
                      // show lock/± only if it's your turn AND you're viewing your own board
                      canLock={viewingSelf && canAct}
                      onToggleLock={(next) => props.onToggleCardLock(c, next)}
                      canAdjustStrength={viewingSelf && canAct && !c.locked}
                      onAdjustStrength={(delta) => props.onAdjustStrength(c, delta)}
                      size="md"
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
