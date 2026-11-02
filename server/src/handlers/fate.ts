import { sendSelf } from "../game/broadcast";
import { drawFromFate, isHero, shuffle, shuffleFateDiscardIntoDeck, take } from "../game/cards";
import { fail } from "../game/errors";
import { getPlayer } from "../game/rooms";
import { assertNoSession, cancelSession, mySession } from "../game/sessions";
import type { Card } from "../protocol";
import type { Player } from "../types";
import type { Binder } from "./binder";

//pops n cards; drawn[0] is the original top card
function popFromFate(target: Player, n: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    const card = target.zones.fateDeck.pop();
    if (!card) break;
    drawn.push(card);
  }
  if (drawn.length === 0) fail("fate deck empty");
  return drawn;
}

//reveals from the top, discarding as it goes. The caller has already checked a Hero exists,
//so working through the deck and then the reshuffled discard always reaches one
function revealUntilHero(target: Player) {
  let revealed = 0;
  for (;;) {
    if (target.zones.fateDeck.length === 0) shuffleFateDiscardIntoDeck(target);
    const card = target.zones.fateDeck.pop()!;
    revealed++;
    if (isHero(card)) return {hero: card, revealed};
    target.zones.fateDiscard.push(card);
  }
}

export function registerFateHandlers({on}: Binder) {
  on("fate:start", "action", ({room, me, payload, commit}) => {
    assertNoSession(room);
    const target = getPlayer(room, payload.targetId, "target not found");
    const drawn = drawFromFate(target, 2);
    if (drawn.length === 0) fail("no fate cards available");

    room.session = {kind: "fate", actorId: me.id, targetId: target.id, drawn, source: "deck"};
    commit();
  });

  on("fate:startFromDiscard", "action", ({room, me, payload, commit}) => {
    assertNoSession(room);
    const target = getPlayer(room, payload.targetId, "target not found");
    const card = take(target.zones.fateDiscard, payload.cardId) ?? fail("card not in fate discard");

    room.session = {kind: "fate", actorId: me.id, targetId: target.id, drawn: [card], chosenId: card.id, source: "discard"};
    commit();
  });

  on("fate:choosePlay", "seated", ({room, me, payload, commit}) => {
    const session = mySession(room, me, "fate");
    if (!session.drawn.some(c => c.id === payload.cardId)) fail("card not in fate choices");
    session.chosenId = payload.cardId;
    commit();
  });

  on("fate:placeSelected", "playing", ({room, me, payload, commit}) => {
    const session = mySession(room, me, "fate");
    const chosen = session.drawn.find(c => c.id === session.chosenId) ?? fail("no chosen card");
    const target = getPlayer(room, session.targetId, "target not found");

    const loc = target.board.locations[payload.locationIndex];
    if (loc.locked && !chosen.ignoresLock) fail("location is locked");

    const other = session.drawn.find(c => c.id !== chosen.id);
    loc.top.push(chosen);
    if (other) target.zones.fateDiscard.push(other);

    delete room.session;
    commit({type: "fate_play", targetId: target.id, locationIndex: payload.locationIndex, discardedOther: !!other});
  });

  on("fate:discardBoth", "seated", ({room, me, commit}) => {
    const session = mySession(room, me, "fate");
    if (session.drawn.length < 2) fail("need two fate cards to discard both");

    const target = getPlayer(room, session.targetId, "target not found");
    target.zones.fateDiscard.push(...session.drawn);
    delete room.session;
    commit({type: "fate_discard_both", targetId: target.id});
  });

  on("fate:discardSelected", "seated", ({room, me, commit}) => {
    const session = mySession(room, me, "fate");
    const chosen = session.drawn.find(c => c.id === session.chosenId) ?? session.drawn[0] ?? fail("no chosen card");
    const target = getPlayer(room, session.targetId, "target not found");

    const other = session.drawn.find(c => c.id !== chosen.id);
    if (other) target.zones.fateDeck.push(other);
    target.zones.fateDiscard.push(chosen);

    delete room.session;
    commit({type: "fate_discard_one", targetId: target.id, label: chosen.label});
  });

  on("fate:cancel", "seated", ({room, me, commit}) => {
    mySession(room, me, "fate");
    cancelSession(room);
    commit();
  });

  on("fate:getDiscard", "seated", ({room, payload}) => {
    const target = getPlayer(room, payload.playerId);
    return {cards: target.zones.fateDiscard.slice().reverse()};
  });

  on("fate:reshuffleDeck", "action", ({room, payload, commit}) => {
    const target = getPlayer(room, payload.playerId);
    const moved = shuffleFateDiscardIntoDeck(target);
    if (moved === 0) fail("fate discard is empty");
    commit({type: "fate_reshuffle", targetId: target.id, moved});
  });

  on("fateDiscard:return", "action", ({room, payload, commit}) => {
    const {cardId} = payload;
    const target = getPlayer(room, payload.playerId);
    const card = take(target.zones.fateDiscard, cardId) ?? fail("card not in fate discard");

    target.zones.fateDeck.push(card);
    shuffle(target.zones.fateDeck);
    commit({type: "fate_return", targetId: target.id, cardId});
  });

  //Peek and sift deliberately do not broadcast on start: nobody else learns the deck shrank
  on("fatePeek:start", "action", ({io, room, me, payload, commit}) => {
    assertNoSession(room);
    const target = getPlayer(room, payload.targetId, "target not found");

    if (payload.reshuffleFirst) {
      const moved = shuffleFateDiscardIntoDeck(target);
      if (moved > 0) commit({type: "fate_reshuffle", targetId: target.id, moved});
    }

    room.session = {kind: "peek", actorId: me.id, targetId: target.id, drawn: popFromFate(target, payload.count)};
    sendSelf(io, room, me);
  });

  on("fatePeek:confirm", "seated", ({room, me, payload, commit}) => {
    const session = mySession(room, me, "peek");
    const target = getPlayer(room, session.targetId, "target not found");

    const byId = new Map(session.drawn.map(c => [c.id, c]));
    const unique = new Set(payload.orderIds);
    if (unique.size !== session.drawn.length || ![...unique].every(id => byId.has(id))) fail("invalid order set");

    //orderIds[0] becomes the new top card, so it goes back last
    for (const id of [...payload.orderIds].reverse()) target.zones.fateDeck.push(byId.get(id)!);

    delete room.session;
    commit({type: "fate_peek", targetId: target.id, count: session.drawn.length});
  });

  on("fatePeek:cancel", "seated", ({room, me, commit}) => {
    mySession(room, me, "peek");
    cancelSession(room);
    commit();
  });

  on("fateSift:start", "action", ({io, room, me, payload}) => {
    assertNoSession(room);
    const target = getPlayer(room, payload.targetId ?? me.id, "target not found");
    room.session = {kind: "sift", actorId: me.id, targetId: target.id, drawn: popFromFate(target, 2)};
    sendSelf(io, room, me);
  });

  on("fateSift:choose", "seated", ({room, me, payload, commit}) => {
    const session = mySession(room, me, "sift");
    const target = getPlayer(room, session.targetId, "target not found");
    const discarded = session.drawn.find(c => c.id === payload.discardId) ?? fail("invalid choice");

    const kept = session.drawn.find(c => c.id !== discarded.id);
    if (kept) target.zones.fateDeck.push(kept);
    target.zones.fateDiscard.push(discarded);

    delete room.session;
    commit({type: "fate_sift", targetId: target.id, discardedLabel: discarded.label, keptOnTop: !!kept});
  });

  on("fateSift:cancel", "seated", ({room, me, commit}) => {
    mySession(room, me, "sift");
    cancelSession(room);
    commit();
  });

  on("fateFindHero:start", "action", ({room, me, payload, commit}) => {
    assertNoSession(room);
    const target = getPlayer(room, payload.targetId, "target not found");

    if (![...target.zones.fateDeck, ...target.zones.fateDiscard].some(isHero)) {
      commit({type: "fate_find_hero", targetId: target.id, revealed: 0, heroLabel: null});
      return {found: false, targetName: target.name, revealed: 0};
    }

    const {hero, revealed} = revealUntilHero(target);
    room.session = {kind: "fate", actorId: me.id, targetId: target.id, drawn: [hero], source: "deck"};
    commit({type: "fate_find_hero", targetId: target.id, revealed, heroLabel: hero.label});
    return {found: true, targetName: target.name, revealed};
  });
}
