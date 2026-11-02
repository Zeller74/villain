import { describe, expect, it } from "vitest";
import { boardCards, deckTotal, drawCard, drawUntil, fateTotal, startGame } from "./helpers";

describe("cards are never destroyed", () => {
  it("keeps the card when the location is locked", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("board:toggleLocationLock", {index: 3, locked: true});

    expect(await a!.error("game:playToLocation", {cardId: card.id, locationIndex: 3})).toBe("location is locked");

    //a refused play sends no state, so force a fresh copy rather than checking a stale one
    await a!.must("power:change", {delta: 1});
    expect(a!.self.hand.map(c => c.id)).toContain(card.id);
    expect(deckTotal(a!.me)).toBe(30);
  });

  it("refuses a second peek, sift, fate or find hero while one is open", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const me = a!.seat.playerId;
    await a!.must("fatePeek:start", {targetId: me, count: 2});
    await a!.error("fatePeek:start", {targetId: me, count: 2});
    await a!.error("fateSift:start", {});
    await a!.error("fate:start", {targetId: b!.seat.playerId});
    await a!.error("fateFindHero:start", {targetId: me});
    await a!.must("fatePeek:cancel");
    expect(fateTotal(a!.me)).toBe(15);
  });

  it("keeps Find Hero from swallowing an open fate", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("fate:start", {targetId: b!.seat.playerId});
    await a!.error("fateFindHero:start", {targetId: b!.seat.playerId});
    await a!.must("fate:cancel");
    expect(fateTotal(a!.player(b!))).toBe(15);
  });

  it("puts peeked cards back in the same order on cancel", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const me = a!.seat.playerId;
    await a!.must("fatePeek:start", {targetId: me, count: 3});
    const order = a!.self.pending!.cards.map(c => c.id);
    await a!.must("fatePeek:cancel");
    await a!.must("fatePeek:start", {targetId: me, count: 3});
    expect(a!.self.pending!.cards.map(c => c.id)).toEqual(order);
  });

  it("applies a confirmed peek order and rejects duplicates", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const me = a!.seat.playerId;
    await a!.must("fatePeek:start", {targetId: me, count: 2});
    const [first, second] = a!.self.pending!.cards.map(c => c.id) as [string, string];

    expect(await a!.error("fatePeek:confirm", {orderIds: [first, first]})).toBe("invalid order set");
    await a!.must("fatePeek:confirm", {orderIds: [second, first]});
    await a!.must("fatePeek:start", {targetId: me, count: 2});
    expect(a!.self.pending!.cards.map(c => c.id)).toEqual([second, first]);
  });

  it("returns a card fated from discard to the discard on cancel", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const target = b!.seat.playerId;
    await a!.must("fate:start", {targetId: target});
    await a!.must("fate:discardBoth");
    const {cards} = await a!.must("fate:getDiscard", {playerId: target});

    await a!.must("fate:startFromDiscard", {targetId: target, cardId: cards[0]!.id});
    await a!.must("fate:cancel");

    expect(a!.player(b!).counts.fateDiscard).toBe(2);
    expect(a!.player(b!).counts.fateDeck).toBe(13);
  });

  it("draws the last card before reshuffling the fate discard", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const target = b!.seat.playerId;
    for (let i = 0; i < 7; i++) {
      await a!.must("fate:start", {targetId: target});
      await a!.must("fate:discardBoth");
    }
    await a!.must("fatePeek:start", {targetId: target, count: 1});
    const lastCard = a!.self.pending!.cards[0]!.id;
    await a!.must("fatePeek:cancel");

    await a!.must("fate:start", {targetId: target});
    expect(a!.self.pending!.cards[0]!.id).toBe(lastCard);
    expect(a!.self.pending!.cards).toHaveLength(2);
  });
});

describe("strength", () => {
  it("clears counters when a card leaves play", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("game:playToLocation", {cardId: card.id, locationIndex: 0});
    await a!.must("card:deltaStrength", {cardId: card.id, delta: 3});
    await a!.must("game:removeCard", {cardId: card.id, from: 0});
    await a!.must("pile:takeFromDiscard", {cardId: card.id});
    expect(a!.self.hand.find(c => c.id === card.id)!.strength).toBe(0);
  });

  it("restores counters when the removal is undone", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("game:playToLocation", {cardId: card.id, locationIndex: 0});
    await a!.must("card:deltaStrength", {cardId: card.id, delta: 3});
    await a!.must("game:removeCard", {cardId: card.id, from: 0});
    await a!.must("log:undoSelf");
    expect(boardCards(a!.me)[0]!.strength).toBe(3);
  });
});

describe("locked cards", () => {
  it("cannot be moved or discarded from the top row", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("game:endTurn");
    await b!.must("fate:start", {targetId: a!.seat.playerId});
    await b!.must("fate:choosePlay", {cardId: b!.self.pending!.cards[0]!.id});
    await b!.must("fate:placeSelected", {locationIndex: 0});
    await b!.must("game:endTurn");
    await a!.sync();

    const card = a!.me.board.locations[0].top[0]!;
    await a!.must("board:toggleCardLock", {cardId: card.id, locked: true});
    expect(await a!.error("board:moveTop", {cardId: card.id, from: 0, to: 1})).toBe("card is locked");
    expect(await a!.error("board:discardTop", {locationIndex: 0, cardId: card.id})).toBe("card is locked");
  });
});

describe("costs", () => {
  it("leaves cards without a printed cost as null, not 0", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const condition = await drawUntil(a!, c => c.type === "Condition");
    expect(condition.cost).toBeNull();
  });
});
