import { describe, expect, it } from "vitest";
import { schemas } from "../src/handlers/schemas";
import type { EventName } from "../src/protocol";
import { startGame, startServer } from "./helpers";

const JUNK: unknown[] = [
  undefined, null, 0, 1, -1, 1.5, NaN, "", "x", "constructor", "__proto__", true, [], {},
  [1, 2], {length: 1}, {name: 123}, {cardId: 5}, {cardIds: {length: 1}}, {cardIds: "abc"},
  {roomId: {}, token: []}, {delta: "abc"}, {delta: 1e308}, {locationIndex: 99}, {index: -1},
  {count: "many"}, {orderIds: 7}, {orderIds: ["a", "a"]}, {targetId: 42}, {text: 9},
];

//leaving or moving rooms mid-sweep would just stop the rest of the sweep testing anything
const STAYS_SEATED = (event: EventName) => !["room:leave", "room:create", "room:join", "room:resume"].includes(event);

describe("server robustness", () => {
  it("survives an ack that is not a function", async () => {
    const {connectClient} = await startServer();
    const client = await connectClient();
    client.socket.emit("room:leave", 1);
    client.socket.emit("room:create", {name: "x"}, "not a function");
    expect((await client.sync()).ok).toBe(true);
  });

  it("refuses wrongly typed fields instead of throwing", async () => {
    const {connectClient} = await startServer();
    const client = await connectClient();
    const res = await new Promise<{ok: boolean}>((r) => client.socket.emit("room:create", {name: 123}, r));
    expect(res.ok).toBe(false);
  });

  it("refuses inherited property names as characters", async () => {
    const {connectClient} = await startServer();
    const client = await connectClient();
    await client.must("room:create", {name: "A"});
    for (const characterId of ["constructor", "__proto__", "toString"]) {
      expect(await client.error("lobby:chooseCharacter", {characterId})).toBe("invalid character id");
    }
  });

  it("stays up when every event receives junk, with and without an ack", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const events = (Object.keys(schemas) as EventName[]).filter(STAYS_SEATED);
    for (const client of [a!, b!]) {
      for (const event of events) {
        for (const junk of JUNK) {
          client.socket.emit(event, junk);
          await new Promise<void>((resolve) => client.socket.emit(event, junk, () => resolve()));
        }
      }
    }
    expect((await a!.sync()).ok).toBe(true);
    expect(a!.me.trust).toBeTypeOf("number");
  }, 30_000);

  it("refuses game events from a socket with no seat", async () => {
    const {connectClient} = await startServer();
    const client = await connectClient();
    expect(await client.error("game:draw", {count: 1})).toBe("not in a room");
  });
});

describe("hidden information", () => {
  it("never broadcasts hands, decks or seat tokens", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    await a!.must("game:draw", {count: 1});
    const card = a!.self.hand[0]!;
    await b!.sync();

    const json = JSON.stringify(b!.state);
    expect(json).not.toContain(a!.seat.token);
    expect(json).not.toContain(b!.seat.token);
    expect(json).not.toContain(card.id);
    expect(json).not.toContain("zones");
  });

  it("does not tell other players about a peek", async () => {
    const {clients: [a, b]} = await startGame(["captain", "lady"]);
    const before = b!.statesReceived;
    await a!.must("fatePeek:start", {targetId: a!.seat.playerId, count: 2});
    await b!.sync();
    expect(b!.statesReceived).toBe(before);
    expect(a!.self.pending?.cards).toHaveLength(2);
  });
});
