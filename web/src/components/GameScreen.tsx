import { useEffect, useMemo, useState } from "react";
import { CardPreviewContext } from "../cardPreview";
import { cx } from "../cx";
import type { Card, LocationIndex, RoomState } from "../protocol";
import type { GameClient } from "../useGameClient";
import { ActionLog } from "./ActionLog";
import { Board, type BoardHandlers } from "./Board";
import { CardFace } from "./CardFace";
import { DiscardModal } from "./DiscardModal";
import { DiscardPeek } from "./DiscardPeek";
import { FateDiscardModal } from "./FateDiscardModal";
import { FatePanel, FatePlaceBanner } from "./FatePanel";
import { FatePeekModal } from "./FatePeekModal";
import { FateSiftModal } from "./FateSiftModal";
import { CardBack, HandPanel } from "./HandPanel";
import { PlayerList } from "./PlayerList";
import { RealmHeader } from "./RealmHeader";
import { RoomChat } from "./RoomChat";
import { RoomHeader } from "./RoomHeader";

type Moving = { cardId: string; from: LocationIndex; label: string; row: "bottom" | "top" };

export function GameScreen({ client, room }: { client: GameClient; room: RoomState }) {
  const {myId, status, hand, pending, messages, logItems, catalog, call, setLastError, leaveRoom} = client;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<Moving | null>(null);
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null);
  const [discardView, setDiscardView] = useState<Card[] | null>(null);
  const [fateDiscardView, setFateDiscardView] = useState<{ targetId: string; cards: Card[] } | null>(null);
  const [previewCard, setPreviewCard] = useState<Card | null>(null);

  const me = room.players.find(p => p.id === myId) ?? null;
  const focusPlayer = room.players.find(p => p.id === focusPlayerId) ?? me ?? room.players[0] ?? null;
  const viewingSelf = !!me && focusPlayer?.id === me.id;
  const isMyTurn = !!me && room.game.activePlayerId === me.id;
  const canAct = room.game.phase === "playing" && (isMyTurn || !!me?.reacting);
  const canEdit = viewingSelf && room.game.phase === "playing";

  const fate = pending?.kind === "fate" ? pending : null;
  const placingCard = fate?.cards.find(c => c.id === fate.chosenId) ?? null;
  const lastLog = logItems[0];
  const canUndo = canAct && !!lastLog && lastLog.actorId === myId && lastLog.undoable;
  const activeMoving = canAct ? moving : null;

  //only what is still in hand counts as selected
  const selected = useMemo(
    () => new Set(hand.filter(c => selectedIds.has(c.id)).map(c => c.id)),
    [hand, selectedIds],
  );

  //a fate plays out on the target's board, including one restored after a reload
  const fateTargetId = fate?.targetId;
  useEffect(() => {
    if (fateTargetId) setFocusPlayerId(fateTargetId);
  }, [fateTargetId]);

  const characterName = (id: string) => catalog.find(c => c.id === id)?.name ?? id;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const playSelectedTo = (locationIndex: LocationIndex) => {
    const [cardId] = selected;
    if (cardId) call("game:playToLocation", {cardId, locationIndex}, () => setSelectedIds(new Set()));
  };

  const discardSelected = () => {
    call("game:discard", {cardIds: [...selected]}, () => setSelectedIds(new Set()));
  };

  const playEffect = (card: Card) => {
    call("game:playEffect", {cardId: card.id}, () => setSelectedIds(new Set()));
  };

  const dropMove = (to: LocationIndex) => {
    if (!activeMoving) return;
    if (activeMoving.from === to) {
      setMoving(null);
      return;
    }
    const {cardId, from, row} = activeMoving;
    call(row === "top" ? "board:moveTop" : "game:moveCard", {cardId, from, to}, () => setMoving(null));
  };

  const discardMoving = () => {
    if (!activeMoving) return;
    const {cardId, from, row} = activeMoving;
    const done = () => setMoving(null);
    if (row === "top") call("board:discardTop", {locationIndex: from, cardId}, done);
    else call("game:removeCard", {cardId, from}, done);
  };

  const startMove = (card: Card, from: LocationIndex, row: Moving["row"]) => {
    if (activeMoving?.cardId === card.id) {
      setMoving(null);
      return;
    }
    if (card.locked) {
      setLastError("Card is locked");
      return;
    }
    setMoving({cardId: card.id, from, label: card.label, row});
  };

  //a click on a card acts on that card, unless something is being dropped onto its location
  const clickBoardCard = (card: Card, i: LocationIndex, row: Moving["row"]) => {
    if (!viewingSelf || !canAct) return;
    if (activeMoving?.row === row && activeMoving.from !== i) {
      dropMove(i);
      return;
    }
    startMove(card, i, row);
  };

  const placeFate = (locationIndex: LocationIndex) => {
    if (focusPlayer?.id === fate?.targetId) call("fate:placeSelected", {locationIndex});
  };

  const boardHandlers: BoardHandlers = {
    onPawn: (to) => call("pawn:set", {to}),
    onToggleLocationLock: (index, locked) => call("board:toggleLocationLock", {index, locked}),
    onToggleCardLock: (card, locked) => call("board:toggleCardLock", {cardId: card.id, locked}),
    onAdjustStrength: (card, delta) => call("card:deltaStrength", {cardId: card.id, delta}),
    onTopZone: (i) => {
      if (placingCard) placeFate(i);
      else if (viewingSelf && activeMoving?.row === "top") dropMove(i);
    },
    onTopCard: (card, i) => {
      if (placingCard) placeFate(i);
      else clickBoardCard(card, i, "top");
    },
    onBottomZone: (i) => {
      if (!viewingSelf || !canAct) return;
      if (activeMoving?.row === "bottom") dropMove(i);
      else if (selected.size === 1) playSelectedTo(i);
      else if (selected.size > 1) setLastError("Select exactly one card to play.");
    },
    onBottomCard: (card, i) => clickBoardCard(card, i, "bottom"),
  };

  const openDiscard = (playerId: string) => {
    call("pile:getDiscard", {playerId}, (res) => setDiscardView(res.cards));
  };

  const openFateDiscard = (targetId: string) => {
    call("fate:getDiscard", {playerId: targetId}, (res) => setFateDiscardView({targetId, cards: res.cards}));
  };

  const takeFromDiscard = (card: Card) => {
    call("pile:takeFromDiscard", {cardId: card.id}, () => {
      setDiscardView(cards => cards?.filter(c => c.id !== card.id) ?? null);
    });
  };

  const winners = room.players.filter(p => p.won);
  const turnStatus =
    room.game.phase !== "playing" ? "Game over"
    : isMyTurn ? "Your turn"
    : me?.reacting ? "Responding"
    : "Waiting…";

  return (
    <CardPreviewContext.Provider value={setPreviewCard}>
      <div className="game" data-villain={focusPlayer?.characterId}>
        <RoomHeader
          roomId={room.roomId}
          status={status}
          onLeave={leaveRoom}
          center={
            <>
              <span>Turn {room.game.turn} — Active: {room.players.find(p => p.id === room.game.activePlayerId)?.name ?? "—"}</span>
              <span className={cx("turn-status", canAct && "is-on")}>{turnStatus}</span>
            </>
          }
          actions={
            <>
              {viewingSelf && (
                <button
                  onClick={() => call("game:claimWin", {})}
                  disabled={room.game.phase !== "playing" || !!me?.won}
                  title="Announce that you've achieved your objective"
                >
                  I Win
                </button>
              )}
              <button onClick={() => call("log:undoSelf", {})} disabled={!canUndo}>Undo</button>
              <button className="btn-primary" onClick={() => call("game:endTurn", {})} disabled={!isMyTurn}>
                End Turn
              </button>
            </>
          }
        />

        <main className="game__table">
          <section className="realm">
            {room.game.phase === "ended" && (
              <div className="notice">
                <strong>Game over.</strong>
                <span>Winner: {winners.map(p => p.name).join(", ") || "none"}</span>
                {room.ownerId === myId && (
                  <div className="notice__actions">
                    <button onClick={() => call("game:backToLobby", {})}>Back to lobby</button>
                  </div>
                )}
              </div>
            )}

            {/* A Condition played on someone else's turn */}
            {me?.reacting && !isMyTurn && (
              <div className="notice">
                <span>Resolving your Condition. You can act until you click Done.</span>
                <div className="notice__actions">
                  <button onClick={() => call("reaction:end", {})}>Done</button>
                </div>
              </div>
            )}

            {activeMoving && (
              <div className="notice">
                <span>Moving <strong>{activeMoving.label}</strong></span>
                <span>&middot; click a location to drop</span>
                <div className="notice__actions">
                  <button onClick={discardMoving} title="Send this card to its discard pile">Discard card</button>
                  <button onClick={() => setMoving(null)}>Cancel</button>
                </div>
              </div>
            )}

            {placingCard && <FatePlaceBanner label={placingCard.label} onCancel={() => call("fate:cancel", {})} />}

            {focusPlayer && (
              <>
                <RealmHeader
                  player={focusPlayer}
                  characterName={characterName(focusPlayer.characterId)}
                  viewingSelf={viewingSelf}
                  canAct={canAct}
                  opponents={room.players.filter(p => p.id !== myId)}
                  call={call}
                  onError={setLastError}
                  onOpenFateDiscard={openFateDiscard}
                />
                <Board
                  player={focusPlayer}
                  viewingSelf={viewingSelf}
                  canAct={canAct}
                  canEdit={canEdit}
                  placingFate={!!placingCard}
                  movingRow={activeMoving?.row ?? null}
                  movingCardId={activeMoving?.cardId ?? null}
                  selectedCount={selected.size}
                  {...boardHandlers}
                />
              </>
            )}
          </section>

          {focusPlayer && (
            <section className="dock">
              {fate && !placingCard ? (
                <FatePanel
                  cards={fate.cards}
                  onPlay={(card) => call("fate:choosePlay", {cardId: card.id})}
                  onCancel={() => call("fate:cancel", {})}
                  onDiscardBoth={() => call("fate:discardBoth", {})}
                  onDiscardSelected={() => call("fate:discardSelected", {})}
                />
              ) : (
                <>
                  <div className="dock__piles">
                    <CardBack characterId={focusPlayer.characterId} title="Deck" />
                    <DiscardPeek
                      player={focusPlayer}
                      viewingSelf={viewingSelf}
                      onOpen={() => openDiscard(focusPlayer.id)}
                      onReshuffle={viewingSelf && canAct ? () => call("game:reshuffleDeck", {}) : undefined}
                    />
                  </div>
                  <div className="dock__hand">
                    <HandPanel
                      player={focusPlayer}
                      viewingSelf={viewingSelf}
                      canAct={canAct}
                      hand={hand}
                      selectedIds={selected}
                      onToggle={toggleSelect}
                      onDraw={() => call("game:draw", {count: 1})}
                      onDiscard={discardSelected}
                      onPlayEffect={playEffect}
                    />
                  </div>
                </>
              )}
            </section>
          )}

          <aside className="side">
            <PlayerList
              room={room}
              myId={myId}
              focusId={focusPlayer?.id}
              characterName={characterName}
              onFocus={setFocusPlayerId}
            />
            <ActionLog items={logItems} />
            <RoomChat messages={messages} myId={myId} call={call} />
          </aside>
        </main>

        {previewCard && (
          <div className="card-preview" aria-hidden="true">
            <CardFace card={previewCard} size="lg" />
          </div>
        )}

        {discardView && (
          <DiscardModal
            cards={discardView}
            canTake={viewingSelf && canAct}
            onTakeCard={takeFromDiscard}
            onClose={() => setDiscardView(null)}
          />
        )}
        {fateDiscardView && (
          <FateDiscardModal
            cards={fateDiscardView.cards}
            targetName={room.players.find(p => p.id === fateDiscardView.targetId)?.name ?? "player"}
            canAct={canAct}
            onClose={() => setFateDiscardView(null)}
            onTake={(card) => {
              call("fate:startFromDiscard", {targetId: fateDiscardView.targetId, cardId: card.id}, () => setFateDiscardView(null));
            }}
            onReturnSelected={(card) => {
              call("fateDiscard:return", {playerId: fateDiscardView.targetId, cardId: card.id}, () => setFateDiscardView(null));
            }}
          />
        )}
        {pending?.kind === "peek" && (
          <FatePeekModal
            targetName={pending.targetName}
            cards={pending.cards}
            onCancel={() => call("fatePeek:cancel", {})}
            onConfirm={(orderIds) => call("fatePeek:confirm", {orderIds})}
          />
        )}
        {pending?.kind === "sift" && (
          <FateSiftModal
            targetName={pending.targetName}
            cards={pending.cards}
            onClose={() => call("fateSift:cancel", {})}
            onDiscardOne={(discardId) => call("fateSift:choose", {discardId})}
          />
        )}
      </div>
    </CardPreviewContext.Provider>
  );
}
