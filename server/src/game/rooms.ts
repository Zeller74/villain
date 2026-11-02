import { nanoid } from "nanoid";
import { DEFAULT_CHARACTER_ID } from "../data/characters";
import type { Seat } from "../protocol";
import type { Player, Room } from "../types";
import { emitRoomLog, emitRoomState, postSystem, type GameIo, type GameSocket } from "./broadcast";
import { fail } from "./errors";
import { releaseSessionsOf } from "./sessions";
import { emptyZones, makeEmptyBoard } from "./setup";
import { endGameIfDecided, passTurn } from "./turns";

export type GraceTimes = {lobbyMs: number; gameMs: number};

export const rooms = new Map<string, Room>();

export function createRoom(): Room {
  const room: Room = {
    id: nanoid(6),
    ownerId: "",
    players: [],
    game: {phase: "lobby", turn: 1, activePlayerId: null},
    messages: [],
    log: [],
  };
  rooms.set(room.id, room);
  return room;
}

export function addPlayer(room: Room, name: string): Player {
  const player: Player = {
    id: nanoid(10),
    token: nanoid(24),
    socketId: null,
    name,
    ready: false,
    characterId: DEFAULT_CHARACTER_ID,
    zones: emptyZones(),
    board: makeEmptyBoard(),
    power: 0,
    trust: 0,
    won: false,
    handPublic: false,
    reacting: false,
  };
  room.players.push(player);
  return player;
}

export function getPlayer(room: Room, playerId: string, notFound = "player not found"): Player {
  return room.players.find(p => p.id === playerId) ?? fail(notFound);
}

export function seatOf(room: Room, player: Player): Seat {
  return {roomId: room.id, playerId: player.id, token: player.token};
}

function clearGrace(player: Player) {
  if (player.graceTimer) clearTimeout(player.graceTimer);
  delete player.graceTimer;
}

//points a seat at this socket. A connection that still holds the seat gets dropped,
//since a phone often reconnects before the server notices its old socket is dead
export function takeSeat(io: GameIo, socket: GameSocket, room: Room, player: Player) {
  clearGrace(player);
  if (player.socketId && player.socketId !== socket.id) {
    const previous = io.sockets.sockets.get(player.socketId);
    if (previous) {
      previous.data.roomId = null;
      previous.data.playerId = null;
      previous.disconnect(true);
    }
  }
  player.socketId = socket.id;
  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.playerId = player.id;
}

function currentSeat(socket: GameSocket) {
  const room = socket.data.roomId ? rooms.get(socket.data.roomId) : undefined;
  const player = room?.players.find(p => p.id === socket.data.playerId);
  return room && player ? {room, player} : null;
}

//removes a player for good: gives back any open fate cards and passes the turn on
export function removePlayer(io: GameIo, room: Room, player: Player, reason: string) {
  clearGrace(player);
  releaseSessionsOf(room, player);
  //passed before they leave, so "next" still counts from their seat
  if (room.game.activePlayerId === player.id) passTurn(room);
  room.players = room.players.filter(p => p !== player);

  if (room.players.length === 0) {
    rooms.delete(room.id);
    return;
  }

  postSystem(io, room, `${player.name} left (${reason}).`);
  if (room.ownerId === player.id) room.ownerId = room.players[0]!.id;
  if (room.game.activePlayerId === player.id) room.game.activePlayerId = null;
  endGameIfDecided(room);
  emitRoomState(io, room);
  emitRoomLog(io, room);
}

export function leaveSeat(io: GameIo, socket: GameSocket, reason: string) {
  const seat = currentSeat(socket);
  if (seat) socket.leave(seat.room.id);
  socket.data.roomId = null;
  socket.data.playerId = null;
  if (seat) removePlayer(io, seat.room, seat.player, reason);
}

//a dropped connection only holds the seat. Removal waits for the grace period
export function handleDisconnect(io: GameIo, socket: GameSocket, grace: GraceTimes) {
  const seat = currentSeat(socket);
  if (!seat || seat.player.socketId !== socket.id) return;
  const {room, player} = seat;

  player.socketId = null;
  const ms = room.game.phase === "playing" ? grace.gameMs : grace.lobbyMs;
  player.graceTimer = setTimeout(() => removePlayer(io, room, player, "connection lost"), ms);
  player.graceTimer.unref();

  postSystem(io, room, `${player.name} lost connection.`);
  emitRoomState(io, room);
}
