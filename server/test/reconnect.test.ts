import { describe, expect, it } from "vitest";
import { drawCard, fateTotal, startGame, startServer, type Client } from "./helpers";

const QUICK = {lobbyMs: 40, gameMs: 40};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function reconnect(connectClient: () => Promise<Client>, old: Client) {
  const client = await connectClient();
  client.seat = old.seat;
  await client.must("room:resume", {roomId: old.seat.roomId, token: old.seat.token});
  return client;
}

describe("losing a connection", () => {
  it("holds the seat and keeps the turn", async () => {
    const {connectClient, clients: [a, b]} = await startGame(["captain", "lady"]);
    const card = await drawCard(a!);
    await a!.must("game:playToLocation", {cardId: card.id, locationIndex: 0});
    await a!.must("game:draw", {count: 2});

    a!.close();
    await wait(30);
    await b!.sync();
    expect(b!.player(a!).connected).toBe(false);
    expect(b!.state.game.activePlayerId).toBe(a!.seat.playerId);

    const back = await reconnect(connectClient, a!);
    await b!.sync();
    expect(b!.player(a!).connected).toBe(true);
    expect(back.self.hand).toHaveLength(2);
    expect(back.me.board.locations[0].bottom.map(c => c.id)).toEqual([card.id]);
    await back.must("game:endTurn");
  });

  it("restores an open fate so it can be finished", async () => {
    const {connectClient, clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("fate:start", {targetId: b!.seat.playerId});
    const cards = a!.self.pending!.cards.map(c => c.id);
    a!.close();
    await wait(30);

    const back = await reconnect(connectClient, a!);
    expect(back.self.pending?.kind).toBe("fate");
    expect(back.self.pending?.cards.map(c => c.id)).toEqual(cards);

    await back.must("fate:choosePlay", {cardId: cards[0]!});
    await back.must("fate:placeSelected", {locationIndex: 0});
    expect(fateTotal(back.player(b!))).toBe(15);
  });

  it("sends chat history and the log on resume", async () => {
    const {connectClient, clients: [a]} = await startGame(["captain", "lady"]);
    await a!.must("chat:send", {text: "before the drop"});
    await a!.must("game:draw", {count: 1});
    a!.close();
    await wait(30);

    const client = await connectClient();
    const history = new Promise<{messages: {text: string}[]}>((r) => client.socket.once("chat:history", r));
    await client.must("room:resume", {roomId: a!.seat.roomId, token: a!.seat.token});
    expect((await history).messages.map(m => m.text)).toContain("before the drop");
    expect(client.log.length).toBeGreaterThan(0);
  });

  it("lets a new connection take over while the old one still looks alive", async () => {
    const {connectClient, clients: [a, b]} = await startGame(["captain", "lady"]);
    const dropped = new Promise<string>((r) => a!.socket.once("disconnect", r));

    const back = await reconnect(connectClient, a!);
    expect(await dropped).toBe("io server disconnect");

    await wait(20);
    await b!.sync();
    expect(b!.player(back).connected).toBe(true);
    await back.must("game:draw", {count: 1});
  });

  it("rejects a wrong token", async () => {
    const {connectClient, clients: [a]} = await startGame(["captain", "lady"]);
    const stranger = await connectClient();
    expect(await stranger.error("room:resume", {roomId: a!.seat.roomId, token: "guess"})).toBe("seat not found");
  });

  it("reports a room that no longer exists", async () => {
    const {connectClient} = await startServer();
    const client = await connectClient();
    expect(await client.error("room:resume", {roomId: "gone", token: "x"})).toBe("room not found");
  });
});

describe("the grace period running out", () => {
  it("removes the player and passes the turn to the next seat", async () => {
    const {clients: [a, b, c]} = await startGame(["captain", "lady", "prince"], QUICK);
    await a!.must("game:endTurn");

    b!.close();
    await wait(120);
    await a!.sync();

    expect(a!.state.players.map(p => p.id)).toEqual([a!.seat.playerId, c!.seat.playerId]);
    expect(a!.state.game.activePlayerId).toBe(c!.seat.playerId);
  });

  it("gives back open fate cards and frees fate for everyone", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"], QUICK);
    await a!.must("fate:start", {targetId: b!.seat.playerId});

    a!.close();
    await wait(120);
    await b!.sync();

    expect(fateTotal(b!.me)).toBe(15);
    expect(b!.state.game.activePlayerId).toBe(b!.seat.playerId);
    await b!.must("fate:start", {targetId: b!.seat.playerId});
  });

  it("gives back peeked and sifted cards too", async () => {
    for (const start of ["fatePeek:start", "fateSift:start"] as const) {
      const {clients: [a, b]} = await startGame(["captain", "lady"], QUICK);
      await a!.must("game:endTurn");
      if (start === "fatePeek:start") await b!.must(start, {targetId: a!.seat.playerId, count: 2});
      else await b!.must(start, {targetId: a!.seat.playerId});

      b!.close();
      await wait(120);
      await a!.sync();

      expect(fateTotal(a!.me)).toBe(15);
      await a!.must("fate:start", {targetId: a!.seat.playerId});
    }
  });

  it("closes the fate of a player whose target left", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady", "prince"], QUICK);
    await a!.must("fate:start", {targetId: b!.seat.playerId});

    b!.close();
    await wait(120);
    await a!.sync();

    expect(a!.self.pending).toBeNull();
    await a!.must("fate:start", {targetId: a!.seat.playerId});
  });

  it("does not remove someone who came back in time", async () => {
    const {connectClient, clients: [a, b]} = await startGame(["captain", "lady"], {lobbyMs: 80, gameMs: 80});
    a!.close();
    await wait(20);
    await reconnect(connectClient, a!);
    await wait(120);
    await b!.sync();
    expect(b!.state.players).toHaveLength(2);
  });

  it("deletes the room once everyone has gone", async () => {
    const {connectClient, clients: [a, b]} = await startGame(["captain", "lady"], QUICK);
    a!.close();
    b!.close();
    await wait(120);
    const client = await connectClient();
    expect(await client.error("room:resume", {roomId: a!.seat.roomId, token: a!.seat.token})).toBe("room not found");
  });
});

describe("leaving and joining", () => {
  it("turns away new players once the game has started", async () => {
    const {connectClient, clients: [a]} = await startGame(["captain", "lady"]);
    const late = await connectClient();
    expect(await late.error("room:join", {roomId: a!.seat.roomId, name: "Late"})).toBe("game already started");
  });

  it("passes the turn immediately when the active player leaves on purpose", async () => {
    const {clients: [a, b, c]} = await startGame(["captain", "lady", "prince"]);
    await a!.must("game:endTurn");
    await b!.must("room:leave");
    await a!.sync();
    expect(a!.state.game.activePlayerId).toBe(c!.seat.playerId);
  });

  it("hands the room to the next player when the owner leaves", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("room:leave");
    await b!.sync();
    expect(b!.state.ownerId).toBe(b!.seat.playerId);
  });

  it("ends the game if a winner leaves only one player still going", async () => {
    const {clients: [a, b, c]} = await startGame(["captain", "lady", "prince"]);
    await a!.must("game:claimWin");
    await c!.must("room:leave");
    await b!.sync();
    expect(b!.state.game.phase).toBe("ended");
  });
});
