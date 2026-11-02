import { characterPreviews } from "../data/characters";
import { emitRoomLog, emitRoomState, postChat, postSystem } from "../game/broadcast";
import { fail } from "../game/errors";
import { addPlayer, createRoom, leaveSeat, rooms, seatOf, takeSeat } from "../game/rooms";
import type { Binder } from "./binder";

export function registerRoomHandlers({on, onPublic}: Binder) {
  onPublic("meta:getCharacters", () => ({characters: characterPreviews()}));

  onPublic("room:create", ({io, socket, payload}) => {
    leaveSeat(io, socket, "switching rooms");

    const room = createRoom();
    const player = addPlayer(room, payload.name);
    room.ownerId = player.id;
    takeSeat(io, socket, room, player);

    emitRoomState(io, room);
    emitRoomLog(io, room);
    return seatOf(room, player);
  });

  onPublic("room:join", ({io, socket, payload}) => {
    const room = rooms.get(payload.roomId) ?? fail("room not found");
    //a seat in a running game can only be reclaimed with its token
    if (room.game.phase !== "lobby") fail("game already started");
    if (socket.data.roomId === room.id) fail("already in this room");
    leaveSeat(io, socket, "switching rooms");

    const player = addPlayer(room, payload.name);
    takeSeat(io, socket, room, player);

    socket.emit("chat:history", {roomId: room.id, messages: room.messages});
    emitRoomState(io, room);
    emitRoomLog(io, room);
    return seatOf(room, player);
  });

  onPublic("room:resume", ({io, socket, payload}) => {
    const room = rooms.get(payload.roomId) ?? fail("room not found");
    const player = room.players.find(p => p.token === payload.token) ?? fail("seat not found");
    if (socket.data.roomId !== room.id) leaveSeat(io, socket, "switching rooms");

    const wasGone = player.socketId === null;
    takeSeat(io, socket, room, player);

    if (wasGone) postSystem(io, room, `${player.name} reconnected.`);
    socket.emit("chat:history", {roomId: room.id, messages: room.messages});
    emitRoomState(io, room);
    emitRoomLog(io, room);
    return seatOf(room, player);
  });

  onPublic("room:leave", ({io, socket}) => {
    leaveSeat(io, socket, "left the room");
  });

  on("chat:send", "seated", ({io, room, me, payload}) => {
    postChat(io, room, {playerId: me.id, name: me.name, text: payload.text});
  });
}
