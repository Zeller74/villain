import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { afterEach } from "vitest";
import { createGameServer } from "../src/app";
import type { GraceTimes } from "../src/game/rooms";
import type { Ack, Card, EventName, LogItem, Payload, PublicPlayer, Result, RoomState, Seat, SelfState } from "../src/protocol";

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

//a real client on a real socket, remembering the last thing the server told it
export class Client {
  state!: RoomState;
  self!: SelfState;
  seat!: Seat;
  log: LogItem[] = [];
  statesReceived = 0;

  constructor(readonly socket: Socket) {
    socket.on("room:state", (s: RoomState) => { this.state = s; this.statesReceived++; });
    socket.on("room:self", (s: SelfState) => { this.self = s; });
    socket.on("room:log", (p: {items: LogItem[]}) => { this.log = p.items; });
  }

  call<E extends EventName>(event: E, payload?: Payload<E>) {
    return new Promise<Ack<Result<E>>>((resolve) => this.socket.emit(event, payload ?? {}, resolve));
  }

  async must<E extends EventName>(event: E, payload?: Payload<E>) {
    const res = await this.call(event, payload);
    if (!res.ok) throw new Error(`${event} refused: ${res.error}`);
    return res;
  }

  async error<E extends EventName>(event: E, payload?: Payload<E>) {
    const res = await this.call(event, payload);
    if (res.ok) throw new Error(`${event} should have been refused`);
    return res.error;
  }

  //anything the server sent before now has arrived once this comes back
  sync() {
    return this.call("meta:getCharacters");
  }

  player(who: Client): PublicPlayer {
    return this.state.players.find(p => p.id === who.seat.playerId)!;
  }

  get me() {
    return this.player(this);
  }

  close() {
    this.socket.close();
  }
}

export async function startServer(grace: GraceTimes = {lobbyMs: 60_000, gameMs: 60_000}) {
  const {httpServer, io} = createGameServer({corsOrigins: [], grace});
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  cleanups.push(() => void io.close());

  const connectClient = () => new Promise<Client>((resolve) => {
    const socket = connect(`http://localhost:${port}`, {transports: ["websocket"], reconnection: false});
    cleanups.push(() => socket.close());
    const client = new Client(socket);
    socket.on("connect", () => resolve(client));
  });

  return {connectClient, port};
}

export async function startGame(characters: string[], grace?: GraceTimes) {
  const server = await startServer(grace);
  const clients: Client[] = [];

  for (const [i, characterId] of characters.entries()) {
    const client = await server.connectClient();
    const roomId = clients[0]?.seat.roomId;
    const seat = roomId
      ? await client.must("room:join", {roomId, name: `P${i}`})
      : await client.must("room:create", {name: `P${i}`});
    client.seat = {roomId: seat.roomId, playerId: seat.playerId, token: seat.token};
    await client.must("lobby:chooseCharacter", {characterId});
    await client.must("lobby:setReady", {ready: true});
    clients.push(client);
  }

  await clients[0]!.must("lobby:start");
  await Promise.all(clients.map(c => c.sync()));
  return {...server, clients};
}

export async function drawCard(client: Client) {
  await client.must("game:draw", {count: 1});
  return client.self.hand[client.self.hand.length - 1]!;
}

export async function drawUntil(client: Client, wanted: (c: Card) => boolean) {
  for (let i = 0; i < 30; i++) {
    const card = await drawCard(client);
    if (wanted(card)) return card;
  }
  throw new Error("card never drawn");
}

export const fateTotal = (p: PublicPlayer) =>
  p.counts.fateDeck + p.counts.fateDiscard + p.board.locations.reduce((n, l) => n + l.top.length, 0);

export const boardCards = (p: PublicPlayer) => p.board.locations.flatMap(l => l.bottom);

export const deckTotal = (p: PublicPlayer) =>
  p.counts.deck + p.counts.hand + p.counts.discard + boardCards(p).length;
