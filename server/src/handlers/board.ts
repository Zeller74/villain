import { clearInPlayState, findOnBoard, take } from "../game/cards";
import { fail } from "../game/errors";
import type { Binder } from "./binder";

const MAX_STRENGTH_ADJUST = 20;

export function registerBoardHandlers({on}: Binder) {
  on("board:toggleLocationLock", "playing", ({me, payload, commit}) => {
    const {index} = payload;
    const loc = me.board.locations[index];
    const prev = loc.locked;
    const next = payload.locked ?? !prev;
    if (next === prev) fail("no change");

    loc.locked = next;
    commit({type: "lock", target: "location", loc: index, prev, next});
  });

  on("board:toggleCardLock", "playing", ({me, payload, commit}) => {
    const {cardId} = payload;
    const found = findOnBoard(me, cardId) ?? fail("card not on your board");
    const prev = found.card.locked;
    const next = payload.locked ?? !prev;
    if (next === prev) fail("no change");

    found.card.locked = next;
    commit({type: "lock", target: "card", loc: found.loc, cardId, prev, next});
  });

  on("card:deltaStrength", "playing", ({me, payload, commit}) => {
    const {cardId, delta} = payload;
    const {card, loc} = findOnBoard(me, cardId) ?? fail("card not on your board");
    if (card.locked) fail("card is locked");

    const prev = card.strength;
    const next = Math.max(-MAX_STRENGTH_ADJUST, Math.min(MAX_STRENGTH_ADJUST, prev + delta));
    if (next === prev) fail("no change");

    card.strength = next;
    commit({type: "strength", cardId, loc, prev, next, delta: next - prev});
  });

  on("board:moveTop", "action", ({me, payload, commit}) => {
    const {cardId, from, to} = payload;
    if (from === to) fail("moving within same location not supported");

    const fromLoc = me.board.locations[from];
    const toLoc = me.board.locations[to];
    if (toLoc.locked) fail("destination locked");

    const card = fromLoc.top.find(c => c.id === cardId) ?? fail("card not in top at source");
    if (card.locked) fail("card is locked");

    take(fromLoc.top, cardId);
    toLoc.top.push(card);
    commit({type: "move_top", from, to});
  });

  on("board:discardTop", "action", ({me, payload, commit}) => {
    const {locationIndex, cardId} = payload;
    const loc = me.board.locations[locationIndex];
    if (loc.locked) fail("location is locked");

    const card = loc.top.find(c => c.id === cardId) ?? fail("card not in top at that location");
    if (card.locked) fail("card is locked");

    take(loc.top, cardId);
    clearInPlayState(card);
    me.zones.fateDiscard.push(card);
    commit({type: "fate_discard_top", locationIndex});
  });
}
