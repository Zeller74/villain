import { describe, expect, it } from "vitest";
import { lady } from "../src/data/characters/lady";
import { expandDeck } from "../src/game/cards";
import { boardCards, deckTotal, drawCard, drawUntil, startGame, startServer } from "./helpers";

describe("Condition cards", () => {
  it("can be played on another player's turn, which opens a window to resolve them", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const condition = await drawUntil(a!, c => c.type === "Condition");
    await a!.must("game:endTurn");

    await a!.must("game:playEffect", {cardId: condition.id});
    expect(a!.me.reacting).toBe(true);
    await a!.must("game:draw", {count: 1});

    await a!.must("reaction:end");
    expect(a!.me.reacting).toBe(false);
    expect(await a!.error("game:draw", {count: 1})).toBe("not your turn");
    expect(a!.state.game.activePlayerId).toBe(b!.seat.playerId);
  });

  it("closes the window when the turn passes", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const condition = await drawUntil(a!, c => c.type === "Condition");
    await a!.must("game:endTurn");
    await a!.must("game:playEffect", {cardId: condition.id});
    await b!.must("game:endTurn");
    await a!.sync();
    expect(a!.me.reacting).toBe(false);
  });

  it("closes the window when the Condition is undone", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const condition = await drawUntil(a!, c => c.type === "Condition");
    await a!.must("game:endTurn");
    await a!.must("game:playEffect", {cardId: condition.id});
    await a!.must("log:undoSelf");
    expect(a!.me.reacting).toBe(false);
    expect(a!.self.hand.map(c => c.id)).toContain(condition.id);
  });

  it("does not extend to Effect cards", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const effect = await drawUntil(a!, c => c.type === "Effect");
    await a!.must("game:endTurn");
    expect(await a!.error("game:playEffect", {cardId: effect.id})).toBe("not your turn");
  });
});

describe("fate placement", () => {
  it("refuses ordinary cards on a locked location", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await b!.must("board:toggleLocationLock", {index: 3, locked: true});
    await a!.must("fate:start", {targetId: b!.seat.playerId});
    const card = a!.self.pending!.cards.find(c => !c.ignoresLock)!;
    await a!.must("fate:choosePlay", {cardId: card.id});
    expect(await a!.error("fate:placeSelected", {locationIndex: 3})).toBe("location is locked");
  });

  it("plays The Prince to a locked location, as his card demands", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await b!.must("board:toggleLocationLock", {index: 3, locked: true});

    await a!.must("fate:start", {targetId: b!.seat.playerId});
    while (!a!.self.pending!.cards.some(c => c.label === "The Prince")) {
      await a!.must("fate:discardBoth");
      await a!.must("fate:start", {targetId: b!.seat.playerId});
    }

    const prince = a!.self.pending!.cards.find(c => c.label === "The Prince")!;
    await a!.must("fate:choosePlay", {cardId: prince.id});
    await a!.must("fate:placeSelected", {locationIndex: 3});
    expect(a!.player(b!).board.locations[3].top.map(c => c.label)).toContain("The Prince");
  });

  it("can be backed out of after choosing a card", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("fate:start", {targetId: b!.seat.playerId});
    await a!.must("fate:choosePlay", {cardId: a!.self.pending!.cards[0]!.id});
    await a!.must("fate:cancel");
    expect(a!.self.pending).toBeNull();
  });

  it("must be finished before ending the turn", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("fate:start", {targetId: b!.seat.playerId});
    expect(await a!.error("game:endTurn")).toBe("finish your fate action first");
  });
});

describe("turn rules", () => {
  it("stops other players touching a fate discard out of turn", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const target = b!.seat.playerId;
    await a!.must("fate:start", {targetId: target});
    await a!.must("fate:discardBoth");
    const {cards} = await a!.must("fate:getDiscard", {playerId: target});
    await a!.must("game:endTurn");
    expect(await a!.error("fateDiscard:return", {playerId: target, cardId: cards[0]!.id})).toBe("not your turn");
  });

  it("does not allow game actions in the lobby", async () => {
    const {connectClient} = await startServer();
    const client = await connectClient();
    await client.must("room:create", {name: "A"});
    expect(await client.error("game:endTurn")).toBe("game not started");
    expect(await client.error("game:draw", {count: 1})).toBe("game not started");
  });

  it("advances the round counter when play wraps around", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("game:endTurn");
    await b!.must("game:endTurn");
    await a!.sync();
    expect(a!.state.game.turn).toBe(2);
  });
});

describe("undo", () => {
  it("broadcasts a strength undo to everyone", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("game:playToLocation", {cardId: card.id, locationIndex: 0});
    await a!.must("card:deltaStrength", {cardId: card.id, delta: 2});
    await b!.sync();
    const received = b!.statesReceived;

    await a!.must("log:undoSelf");
    await b!.sync();

    expect(b!.statesReceived).toBeGreaterThan(received);
    expect(boardCards(b!.player(a!))[0]!.strength).toBe(0);
    expect(b!.log[0]!.text).toContain("undid");
  });

  it("is not available once your turn is over", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    await a!.must("game:draw", {count: 2});
    await a!.must("game:endTurn");
    expect(await a!.error("log:undoSelf")).toBe("not your turn");
  });

  it("works once per action and leaves nothing behind", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("game:playToLocation", {cardId: card.id, locationIndex: 1});
    await a!.must("log:undoSelf");
    expect(a!.self.hand.map(c => c.id)).toContain(card.id);
    expect(await a!.error("log:undoSelf")).toBe("that action cannot be undone");
    expect(deckTotal(a!.me)).toBe(30);
  });

  it("restores a draw to the top of the deck", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("log:undoSelf");
    expect((await drawCard(a!)).id).toBe(card.id);
  });

  it("flags in the log what can be undone", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    await a!.must("game:draw", {count: 1});
    expect(a!.log[0]!.undoable).toBe(true);
    await a!.must("power:change", {delta: 1});
    expect(a!.log[0]!.undoable).toBe(false);
  });

  it("only records cards that were really discarded", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    const res = await a!.must("game:discard", {cardIds: [card.id, "not-a-card"]});
    expect(res.discarded).toBe(1);
    expect(a!.log[0]!.text).toContain("discarded 1 card");
    await a!.must("log:undoSelf");
    expect(a!.self.hand.map(c => c.id)).toContain(card.id);
  });
});

describe("the action log", () => {
  it("shows card names rather than ids, and hides the card kept in a sift", async () => {
    const {clients: [a]} = await startGame(["lady", "captain"]);
    await a!.must("fateSift:start");
    const [discarded, kept] = a!.self.pending!.cards;
    await a!.must("fateSift:choose", {discardId: discarded!.id});
    expect(a!.log[0]!.text).toContain(discarded!.label);
    expect(a!.log[0]!.text).not.toContain(discarded!.id);
    expect(a!.log[0]!.text).not.toContain(kept!.id);
  });

  it("records discarding both fate cards straight away", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("fate:start", {targetId: b!.seat.playerId});
    await a!.must("fate:discardBoth");
    expect(a!.log[0]!.text).toContain("discarded both fate cards");
  });

  it("is capped", async () => {
    const {clients: [a]} = await startGame(["captain", "lady"]);
    for (let i = 0; i < 30; i++) await a!.must("power:change", {delta: i % 2 ? -1 : 1});
    expect(a!.log).toHaveLength(25);
  });
});

describe("ending a game", () => {
  it("ends when only one player is left going", async () => {
    const {clients: [a, b, c]} = await startGame(["captain", "lady", "prince"]);
    await a!.must("game:claimWin");
    expect(a!.state.game.phase).toBe("playing");
    expect(a!.state.game.activePlayerId).toBe(b!.seat.playerId);

    await b!.must("game:claimWin");
    await c!.sync();
    expect(c!.state.game.phase).toBe("ended");
    expect(c!.state.game.activePlayerId).toBeNull();
  });

  it("does not accept a second claim", async () => {
    const {clients: [a]} = await startGame(["captain", "lady", "prince"]);
    await a!.must("game:claimWin");
    expect(await a!.error("game:claimWin")).toBe("you already claimed a win");
  });

  it("returns everyone to the lobby for another game", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("game:draw", {count: 2});
    await a!.must("game:claimWin");

    expect(await b!.error("game:backToLobby")).toBe("owner only");
    await a!.must("game:backToLobby");

    expect(a!.state.game.phase).toBe("lobby");
    expect(a!.me.won).toBe(false);
    expect(a!.me.ready).toBe(false);
    expect(a!.me.counts.hand).toBe(0);
    expect(a!.log).toHaveLength(0);

    await a!.must("lobby:setReady", {ready: true});
    await b!.must("lobby:setReady", {ready: true});
    await a!.must("lobby:start");
    expect(a!.me.counts.deck).toBe(30);
  });
});

describe("villain data", () => {
  it("gives every villain a complete deck", async () => {
    const villains = ["maleficent", "captain", "prince", "lady", "mother", "lotso", "pete"];
    const {clients} = await startGame(villains);
    for (const [i, id] of villains.entries()) {
      const p = clients[0]!.state.players[i]!;
      expect(p.counts.deck, `${id} deck`).toBe(30);
      expect(p.counts.fateDeck, `${id} fate deck`).toBe(15);
    }
  });

  it("points every card at its printed image", async () => {
    const {clients: [a]} = await startGame(["lady", "captain"]);
    for (let i = 0; i < 6; i++) await a!.must("game:draw", {count: 5});
    const arts = a!.self.hand.map(c => c.art);
    expect(arts).toContain("lady/i-said-if");
    expect(arts).toContain("lady/invitation-from-the-king");
  });

  it("deals both printed versions of Glass Slipper", () => {
    const slippers = expandDeck(lady.fateDeck, "lady").filter(c => c.label === "Glass Slipper");
    expect(slippers.map(c => c.art)).toEqual(["lady/glass-slipper-cinderellas-room", "lady/glass-slipper-the-castle"]);
    expect(slippers[1]!.desc).toContain("The Castle");
  });

  it("includes Ball Gown Drizella", async () => {
    const {clients: [a]} = await startGame(["lady", "captain"]);
    for (let i = 0; i < 6; i++) await a!.must("game:draw", {count: 5});
    expect(a!.self.hand.map(c => c.label)).toContain("Ball Gown Drizella");
  });

  it("starts Rapunzel and Buzz on the board", async () => {
    const {clients: [a, b]} = await startGame(["mother", "lotso"]);
    expect(a!.me.board.locations[0].top.map(c => c.label)).toEqual(["Rapunzel"]);
    expect(a!.player(b!).board.locations[0].top.map(c => c.label)).toEqual(["Buzz Lightyear"]);
  });

  it("flips Buzz both ways", async () => {
    const {clients: [a]} = await startGame(["lotso", "captain"]);
    await a!.must("lotso:flipBuzz");
    expect(a!.me.board.locations[0].bottom.map(c => c.label)).toEqual(["Demo Mode Buzz Lightyear"]);
    await a!.must("lotso:flipBuzz");
    expect(a!.me.board.locations[0].top.map(c => c.label)).toEqual(["Buzz Lightyear"]);
  });
});
