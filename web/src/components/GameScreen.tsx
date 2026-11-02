import { useEffect, useMemo, useState } from "react";
import type { Card, LocationIndex, RoomState } from "../protocol";
import { panel, raisedPanel } from "../theme";
import type { GameClient } from "../useGameClient";
import { ActionLog } from "./ActionLog";
import { Board, type BoardHandlers } from "./Board";
import { DiscardModal } from "./DiscardModal";
import { DiscardPeek } from "./DiscardPeek";
import { FateBar } from "./FateBar";
import { FateDiscardModal } from "./FateDiscardModal";
import { FatePanel, FatePlaceBanner } from "./FatePanel";
import { FatePeekModal } from "./FatePeekModal";
import { FateSiftModal } from "./FateSiftModal";
import { HandPanel } from "./HandPanel";
import { InfoBar } from "./InfoBar";
import { PlayerPanel } from "./PlayerPanel";
import { RoomChat } from "./RoomChat";
import { RoomHeader } from "./RoomHeader";

type Moving = { cardId: string; from: LocationIndex; label: string; row: "bottom" | "top" };

export function GameScreen({ client, room }: { client: GameClient; room: RoomState }) {
  const {myId, hand, pending, messages, logItems, catalog, call, setLastError, leaveRoom} = client;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moving, setMoving] = useState<Moving | null>(null);
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null);
  const [discardView, setDiscardView] = useState<Card[] | null>(null);
  const [fateDiscardView, setFateDiscardView] = useState<{ targetId: string; cards: Card[] } | null>(null);

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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <RoomHeader roomId={room.roomId} onLeave={leaveRoom} />

      {/* Turn bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <strong>Turn:</strong> {room.game.turn}{" "}
          <span style={{ opacity: 0.8 }}>
            — Active: {room.players.find(p => p.id === room.game.activePlayerId)?.name ?? "—"}
          </span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          {viewingSelf && (
            <button
              onClick={() => call("game:claimWin", {})}
              disabled={room.game.phase !== "playing" || !!me?.won}
              title="Announce that you've achieved your objective"
              style={{ marginLeft: 6 }}
            >
              I Win
            </button>
          )}
          <button onClick={() => call("game:endTurn", {})} disabled={!isMyTurn}>
            End Turn
          </button>
          <button onClick={() => call("log:undoSelf", {})} disabled={!canUndo} style={{ marginLeft: 8 }}>
            Undo
          </button>
          {!canAct && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>(not your turn)</span>
          )}
        </div>
      </div>

      {room.game.phase === "ended" && (
        <div style={{ ...panel, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Game over.</strong>
          <span>🏆 {winners.map(p => p.name).join(", ") || "No winner"}</span>
          <span style={{ marginLeft: "auto" }} />
          {room.ownerId === myId && (
            <button onClick={() => call("game:backToLobby", {})}>Back to lobby</button>
          )}
        </div>
      )}

      {/* A Condition played on someone else's turn */}
      {me?.reacting && !isMyTurn && (
        <div style={{ ...panel, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span>Resolving your Condition. You can act until you click Done.</span>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={() => call("reaction:end", {})}>Done</button>
        </div>
      )}

      {/* Camera controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <strong>View:</strong>
        {room.players.map(p => (
          <button
            key={p.id}
            onClick={() => setFocusPlayerId(p.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: p.id === focusPlayer?.id ? "2px solid #3b82f6" : "1px solid #334155",
              background: p.id === focusPlayer?.id ? "#1e293b" : "#111827",
              color: "#e5e7eb"
            }}
          >
            {p.name}{p.id === myId ? " (you)" : ""}{p.won ? " 🏆" : ""}{p.connected ? "" : " (offline)"}
          </button>
        ))}
      </div>

      {/*Move mode banner*/}
      {activeMoving && (
        <div style={{
          border: "1px solid #334155", borderRadius: 8, padding: "6px 10px",
          background: "#111827", color: "#e5e7eb", display: "flex", alignItems: "center", gap: 8
        }}>
          Moving <strong>{activeMoving.label}</strong>
          <span style={{ opacity: 0.7 }}>&middot; click a location to drop</span>
          <button onClick={discardMoving} style={{ marginLeft: "auto" }} title="Send this card to its discard pile">
            Discard card
          </button>
          <button onClick={() => setMoving(null)}>Cancel</button>
        </div>
      )}

      {focusPlayer && (
        <>
          <InfoBar
            focusPlayer={focusPlayer}
            viewingSelf={viewingSelf}
            canAct={canAct}
            phase={room.game.phase}
            characterName={characterName(focusPlayer.characterId)}
            onChangePower={(delta) => call("power:change", {delta})}
          />

          {/* BOARD panel (dark) */}
          <div style={{ ...raisedPanel, padding: 12 }}>
            <FateBar
              focusPlayer={focusPlayer}
              viewingSelf={viewingSelf}
              canAct={canAct}
              opponents={room.players.filter(p => p.id !== myId)}
              onStartFate={(targetId) => call("fate:start", {targetId})}
              onReshuffleFate={(playerId) => call("fate:reshuffleDeck", {playerId})}
              onOpenFateDiscard={openFateDiscard}
            />
            <Board
              player={focusPlayer}
              viewingSelf={viewingSelf}
              canAct={canAct}
              canEdit={canEdit}
              placingFate={!!placingCard}
              movingRow={activeMoving?.row ?? null}
              selectedCount={selected.size}
              {...boardHandlers}
            />
          </div>

          {fate && !placingCard && (
            <FatePanel
              cards={fate.cards}
              onPlay={(card) => call("fate:choosePlay", {cardId: card.id})}
              onCancel={() => call("fate:cancel", {})}
              onDiscardBoth={() => call("fate:discardBoth", {})}
              onDiscardSelected={() => call("fate:discardSelected", {})}
            />
          )}
          {placingCard && <FatePlaceBanner label={placingCard.label} onCancel={() => call("fate:cancel", {})} />}

          {/* HAND panel (dark) */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12, alignItems: "start" }}>
            <PlayerPanel
              player={focusPlayer}
              characterName={characterName(focusPlayer.characterId)}
              viewingSelf={viewingSelf}
              canAct={canAct}
              call={call}
              onError={setLastError}
            />
            <div style={{ ...raisedPanel, padding: 12 }}>
              <DiscardPeek
                player={focusPlayer}
                myId={myId}
                onOpen={() => openDiscard(focusPlayer.id)}
                onReshuffle={viewingSelf && canAct ? () => call("game:reshuffleDeck", {}) : undefined}
              />
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
          </div>
        </>
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

      <div style={{ marginTop: 8 }}>
        <RoomChat messages={messages} myId={myId} call={call} />
      </div>

      <ActionLog items={logItems} />
    </div>
  );
}
