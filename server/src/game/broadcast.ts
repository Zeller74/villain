import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import type { ChatMsg, Pending, PublicPlayer, RoomState, SelfState, ServerEvents } from "../protocol";
import type { Player, Room } from "../types";
import { buildLogItems } from "./log";

const MAX_MESSAGES = 100;

export type SocketData = {roomId: string | null; playerId: string | null};
type Inbound = Record<string, (...args: never[]) => void>;
export type GameIo = Server<Inbound, ServerEvents, Inbound, SocketData>;
export type GameSocket = Socket<Inbound, ServerEvents, Inbound, SocketData>;

//the only view of a player other clients get. Hands, decks and the seat token stay out of it
function publicPlayer(p: Player): PublicPlayer {
  const {deck, hand, discard, fateDeck, fateDiscard} = p.zones;
  return {
    id: p.id,
    name: p.name,
    ready: p.ready,
    connected: p.socketId !== null,
    characterId: p.characterId,
    won: p.won,
    reacting: p.reacting,
    power: p.power,
    trust: p.trust,
    counts: {
      deck: deck.length,
      hand: hand.length,
      discard: discard.length,
      fateDeck: fateDeck.length,
      fateDiscard: fateDiscard.length,
    },
    discardTop: discard[discard.length - 1] ?? null,
    handPublic: p.handPublic,
    publicHand: p.handPublic ? hand.slice() : null,
    board: p.board,
  };
}

function pendingFor(room: Room, player: Player): Pending | null {
  const session = room.session;
  if (!session || session.actorId !== player.id) return null;
  const base = {
    targetId: session.targetId,
    targetName: room.players.find(p => p.id === session.targetId)?.name ?? "player",
    cards: session.drawn,
  };
  return session.kind === "fate"
    ? {kind: "fate", ...base, chosenId: session.chosenId ?? null}
    : {kind: session.kind, ...base};
}

export function sendSelf(io: GameIo, room: Room, player: Player) {
  if (!player.socketId) return;
  const self: SelfState = {roomId: room.id, hand: player.zones.hand, pending: pendingFor(room, player)};
  io.to(player.socketId).emit("room:self", self);
}

export function emitRoomState(io: GameIo, room: Room) {
  const state: RoomState = {
    roomId: room.id,
    ownerId: room.ownerId,
    players: room.players.map(publicPlayer),
    game: room.game,
  };
  io.to(room.id).emit("room:state", state);
  for (const player of room.players) sendSelf(io, room, player);
}

export function emitRoomLog(io: GameIo, room: Room) {
  io.to(room.id).emit("room:log", {items: buildLogItems(room)});
}

export function postChat(io: GameIo, room: Room, msg: Omit<ChatMsg, "id" | "ts">) {
  const full: ChatMsg = {id: nanoid(8), ts: Date.now(), ...msg};
  room.messages.push(full);
  if (room.messages.length > MAX_MESSAGES) room.messages = room.messages.slice(-MAX_MESSAGES);
  io.to(room.id).emit("chat:msg", {roomId: room.id, msg: full});
}

export function postSystem(io: GameIo, room: Room, text: string) {
  postChat(io, room, {playerId: "system", name: "System", text});
}
