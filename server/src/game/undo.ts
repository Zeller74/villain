import type { ActionOf, ActionType, Player, Room } from "../types";
import { findOnBoard, take } from "./cards";
import { fail } from "./errors";

type Undoers = {[T in ActionType]?: (ctx: {room: Room; me: Player}, data: ActionOf<T>) => void};

//anything not listed here cannot be undone
const UNDOERS: Undoers = {
  draw: ({me}, {cardIds}) => {
    if (!cardIds.every(id => me.zones.hand.some(c => c.id === id))) fail("cannot undo: cards already moved");
    //last drawn goes back first, so the original top card ends up on top
    for (const id of [...cardIds].reverse()) me.zones.deck.push(take(me.zones.hand, id)!);
  },
  play: ({me}, {cardId, locationIndex}) => {
    const card = take(me.board.locations[locationIndex].bottom, cardId) ?? fail("card not on board anymore");
    me.zones.hand.push(card);
  },
  discard: ({me}, {cardIds}) => {
    const pile = me.zones.discard;
    const tail = pile.slice(-cardIds.length).map(c => c.id);
    if (tail.join() !== cardIds.join()) fail("cannot undo: discard changed");
    me.zones.hand.push(...pile.splice(-cardIds.length));
  },
  move: ({me}, {cardId, from, to, fromIndex}) => {
    const card = take(me.board.locations[to].bottom, cardId) ?? fail("card not in destination anymore");
    me.board.locations[from].bottom.splice(fromIndex, 0, card);
  },
  remove: ({me}, {cardId, from, fromIndex, strength}) => {
    const top = me.zones.discard[me.zones.discard.length - 1];
    if (top?.id !== cardId) fail("cannot undo: discard changed");
    const card = me.zones.discard.pop()!;
    card.strength = strength;
    me.board.locations[from].bottom.splice(fromIndex, 0, card);
  },
  retrieve: ({me}, {cardId, fromIndex}) => {
    const card = take(me.zones.hand, cardId) ?? fail("cannot undo: card moved from hand");
    me.zones.discard.splice(fromIndex, 0, card);
  },
  pawn: ({me}, {prev}) => {
    me.board.moverAt = prev;
  },
  lock: ({me}, data) => {
    if (data.target === "location") {
      me.board.locations[data.loc].locked = data.prev;
      return;
    }
    const found = findOnBoard(me, data.cardId) ?? fail("card not found");
    found.card.locked = data.prev;
  },
  strength: ({me}, {cardId, prev}) => {
    const found = findOnBoard(me, cardId) ?? fail("card not found");
    found.card.strength = prev;
  },
  play_effect: ({me}, {cardId, openedReaction}) => {
    const card = take(me.zones.discard, cardId) ?? fail("card not in discard");
    me.zones.hand.push(card);
    if (openedReaction) me.reacting = false;
  },
  fate_return: ({room}, {targetId, cardId}) => {
    const target = room.players.find(p => p.id === targetId) ?? fail("target not found for undo");
    const card = take(target.zones.fateDeck, cardId) ?? fail("card not in fate deck");
    target.zones.fateDiscard.push(card);
  },
};

export function isUndoable(type: ActionType) {
  return type in UNDOERS;
}

export function undoAction(room: Room, me: Player, data: ActionOf<ActionType>) {
  const undo = UNDOERS[data.type] as ((ctx: {room: Room; me: Player}, data: ActionOf<ActionType>) => void) | undefined;
  if (!undo) fail("that action cannot be undone");
  undo({room, me}, data);
}
