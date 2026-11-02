import { postChat } from "../game/broadcast";
import { clearInPlayState, reshuffleFromDiscardIntoDeck, shuffleDiscardIntoDeck, take } from "../game/cards";
import { fail } from "../game/errors";
import { getPlayer } from "../game/rooms";
import { canAct, endGameIfDecided, passTurn } from "../game/turns";
import { undoAction } from "../game/undo";
import type { Binder } from "./binder";

const MAX_POWER = 50;
const MAX_TRUST = 50;

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));

export function registerGameHandlers({on}: Binder) {
  on("game:endTurn", "playing", ({room, me, commit}) => {
    if (room.game.activePlayerId !== me.id) fail("not your turn");
    if (room.session?.actorId === me.id) fail("finish your fate action first");
    passTurn(room);
    commit();
  });

  on("reaction:end", "playing", ({me, commit}) => {
    me.reacting = false;
    commit();
  });

  on("game:draw", "action", ({me, payload, commit}) => {
    const cardIds: string[] = [];
    for (let i = 0; i < (payload.count ?? 1); i++) {
      reshuffleFromDiscardIntoDeck(me);
      const card = me.zones.deck.pop();
      if (!card) break;
      me.zones.hand.push(card);
      cardIds.push(card.id);
    }
    if (cardIds.length === 0) fail("no cards left to draw");
    commit({type: "draw", cardIds});
  });

  on("game:playToLocation", "action", ({me, payload, commit}) => {
    const {cardId, locationIndex} = payload;
    const loc = me.board.locations[locationIndex];
    if (loc.locked) fail("location is locked");

    const card = take(me.zones.hand, cardId) ?? fail("card not in hand");
    loc.bottom.push(card);
    commit({type: "play", cardId, locationIndex});
  });

  on("game:playEffect", "playing", ({room, me, payload, commit}) => {
    const {cardId} = payload;
    const card = me.zones.hand.find(c => c.id === cardId) ?? fail("card not in hand");
    if (card.type !== "Effect" && card.type !== "Condition") fail("only effects/conditions can be played this way");

    const onTurn = canAct(room, me);
    if (card.type === "Effect" && !onTurn) fail("not your turn");

    take(me.zones.hand, cardId);
    me.zones.discard.push(card);
    //a Condition played on someone else's turn lets its player act until they finish it
    if (!onTurn) me.reacting = true;
    commit({type: "play_effect", cardId, label: card.label, openedReaction: !onTurn});
  });

  on("game:discard", "action", ({me, payload, commit}) => {
    const cardIds: string[] = [];
    for (const id of payload.cardIds) {
      const card = take(me.zones.hand, id);
      if (!card) continue;
      me.zones.discard.push(card);
      cardIds.push(id);
    }
    if (cardIds.length === 0) fail("card(s) not in hand");
    commit({type: "discard", cardIds});
    return {discarded: cardIds.length};
  });

  on("game:moveCard", "action", ({me, payload, commit}) => {
    const {cardId, from, to} = payload;
    if (from === to) fail("moving within same location not supported");

    const fromLoc = me.board.locations[from];
    const toLoc = me.board.locations[to];
    const fromIndex = fromLoc.bottom.findIndex(c => c.id === cardId);
    if (fromIndex === -1) fail("card not in source location (bottom)");
    if (fromLoc.bottom[fromIndex]!.locked) fail("card is locked");
    if (toLoc.locked) fail("destination locked");

    toLoc.bottom.push(fromLoc.bottom.splice(fromIndex, 1)[0]!);
    commit({type: "move", cardId, from, to, fromIndex});
  });

  on("game:removeCard", "action", ({me, payload, commit}) => {
    const {cardId, from} = payload;
    const row = me.board.locations[from].bottom;
    const fromIndex = row.findIndex(c => c.id === cardId);
    if (fromIndex === -1) fail("card not on that location (bottom)");
    if (row[fromIndex]!.locked) fail("card is locked");

    const card = row.splice(fromIndex, 1)[0]!;
    const strength = card.strength;
    clearInPlayState(card);
    me.zones.discard.push(card);
    commit({type: "remove", cardId, from, fromIndex, strength});
  });

  on("game:reshuffleDeck", "action", ({me, commit}) => {
    const moved = shuffleDiscardIntoDeck(me);
    if (moved === 0) fail("discard is empty");
    commit({type: "reshuffle", moved});
  });

  on("pile:getDiscard", "seated", ({room, payload}) => {
    const target = getPlayer(room, payload.playerId);
    return {cards: target.zones.discard.slice().reverse()};
  });

  on("pile:takeFromDiscard", "action", ({me, payload, commit}) => {
    const {cardId} = payload;
    const fromIndex = me.zones.discard.findIndex(c => c.id === cardId);
    if (fromIndex === -1) fail("card not in your discard");
    me.zones.hand.push(me.zones.discard.splice(fromIndex, 1)[0]!);
    commit({type: "retrieve", cardId, fromIndex});
  });

  on("log:undoSelf", "action", ({room, me, commit}) => {
    const last = room.log[room.log.length - 1];
    if (!last) fail("nothing to undo");
    if (last.actorId !== me.id) fail("only your last action can be undone");
    undoAction(room, me, last.data);
    commit({type: "undo", actionId: last.id});
  });

  on("power:change", "playing", ({me, payload, commit}) => {
    const prev = me.power;
    const next = clamp(prev + payload.delta, MAX_POWER);
    if (next === prev) fail("no change");
    me.power = next;
    commit({type: "power", delta: next - prev, prev, next});
  });

  on("trust:change", "action", ({me, payload, commit}) => {
    const prev = me.trust;
    const next = clamp(prev + payload.delta, MAX_TRUST);
    if (next === prev) fail("no change");
    me.trust = next;
    commit({type: "trust", delta: next - prev, prev, next});
  });

  on("pawn:set", "action", ({me, payload, commit}) => {
    const {to} = payload;
    const prev = me.board.moverAt;
    if (me.board.locations[to].locked) fail("location is locked");
    if (prev === to) fail("no change");
    me.board.moverAt = to;
    commit({type: "pawn", prev, next: to});
  });

  on("game:claimWin", "playing", ({io, room, me, commit}) => {
    if (me.won) fail("you already claimed a win");
    me.won = true;
    postChat(io, room, {playerId: me.id, name: me.name, text: `${me.name} has claimed victory! 🏆`});

    if (room.game.activePlayerId === me.id) passTurn(room);
    endGameIfDecided(room);
    commit();
  });
}
