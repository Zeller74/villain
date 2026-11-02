import { cx } from "../cx";
import type { Card, LocationIndex, PublicPlayer } from "../protocol";
import { CardFace } from "./CardFace";
import { Icon } from "./Icon";
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
  movingCardId: string | null;
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
  const {player, viewingSelf, canAct, canEdit, placingFate, movingRow, movingCardId, selectedCount} = props;
  const canSetPawn = viewingSelf && canAct;

  return (
    <div className="board">
      {player.board.locations.map((loc, index) => {
        const i = index as LocationIndex;
        const isPawnHere = player.board.moverAt === i;
        const dropping = movingRow === "bottom" || (viewingSelf && canAct && selectedCount === 1);

        return (
          <div key={loc.id} className={cx("location frame", isPawnHere && "is-pawn", loc.locked && "is-locked")}>
            <div
              className={cx("location__head", canSetPawn && "can-move")}
              title={
                isPawnHere ? "Pawn is here"
                : canSetPawn ? "Click to move pawn here"
                : undefined
              }
              onClick={() => { if (canSetPawn) props.onPawn(i); }}
            >
              {isPawnHere && <Icon name="pawn" className="pawn" />}
              <span className="location__name">{loc.name}</span>
              {loc.locked && <span className="location__lock" title="Location locked"><Icon name="lock" /></span>}
              {canSetPawn && (
                <button
                  className={cx(loc.locked && "is-on")}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleLocationLock(i, !loc.locked);
                  }}
                  title={loc.locked ? "Unlock this location" : "Lock this location"}
                >
                  {loc.locked ? "Unlock" : "Lock"}
                </button>
              )}
            </div>

            {/* Top (public) */}
            <div
              data-testid={`top-${i}`}
              className={cx("zone", (placingFate || movingRow === "top") && "is-target")}
              onClick={() => props.onTopZone(i)}
              title={placingFate ? "Click to place fate card here (Top)" : undefined}
            >
              {loc.top.length === 0 && <span className="zone__label label">Top</span>}
              <div className="fan">
                {loc.top.map((c) => (
                  <div key={c.id} className="slot">
                    <CardFace
                      card={c}
                      locked={c.locked}
                      active={c.id === movingCardId}
                      onClick={() => props.onTopCard(c, i)}
                      canLock={canEdit}
                      onToggleLock={(next) => props.onToggleCardLock(c, next)}
                      canAdjustStrength={canEdit && !c.locked}
                      onAdjustStrength={(delta) => props.onAdjustStrength(c, delta)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <LocationActions actions={loc.actions} topSlots={loc.topSlots} hasTopCover={loc.top.length > 0} />

            {/* Bottom (your plays) */}
            <div
              data-testid={`bottom-${i}`}
              className={cx("zone", dropping && "is-target")}
              onClick={() => props.onBottomZone(i)}
              title={bottomTitle({viewingSelf, canAct, locked: loc.locked, moving: movingRow === "bottom", selectedCount})}
            >
              {loc.bottom.length === 0 && <span className="zone__label label">Bottom</span>}
              <div className="fan">
                {loc.bottom.map((c) => (
                  <div key={c.id} className="slot">
                    <CardFace
                      card={c}
                      locked={c.locked}
                      active={c.id === movingCardId}
                      onClick={() => props.onBottomCard(c, i)}
                      // show lock/± only if it's your turn AND you're viewing your own board
                      canLock={viewingSelf && canAct}
                      onToggleLock={(next) => props.onToggleCardLock(c, next)}
                      canAdjustStrength={viewingSelf && canAct && !c.locked}
                      onAdjustStrength={(delta) => props.onAdjustStrength(c, delta)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
