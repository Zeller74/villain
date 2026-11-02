import { getCharacter, isCharacterId } from "../data/characters";
import { emitRoomLog, postSystem } from "../game/broadcast";
import { fail } from "../game/errors";
import { cancelSession } from "../game/sessions";
import { resetPlayerForLobby, setupPlayerForGame } from "../game/setup";
import type { Binder } from "./binder";

export function registerLobbyHandlers({on}: Binder) {
  on("lobby:chooseCharacter", "lobby", ({io, room, me, payload, commit}) => {
    if (!isCharacterId(payload.characterId)) fail("invalid character id");
    me.characterId = payload.characterId;
    commit();
    postSystem(io, room, `${me.name} chose ${getCharacter(me.characterId).name}`);
  });

  on("lobby:setReady", "lobby", ({me, payload, commit}) => {
    me.ready = payload.ready;
    commit();
  });

  on("lobby:start", "lobby", ({io, room, me, commit}) => {
    if (room.ownerId !== me.id) fail("owner only");
    if (room.players.length < 2) fail("need at least 2 players");
    if (!room.players.every(p => p.ready)) fail("not all ready");

    room.players.forEach(setupPlayerForGame);
    room.log = [];
    room.game = {phase: "playing", turn: 1, activePlayerId: room.players[0]!.id};

    commit();
    emitRoomLog(io, room);
    postSystem(io, room, "Game started!");
  });

  on("game:backToLobby", "seated", ({io, room, me, commit}) => {
    if (room.game.phase !== "ended") fail("game is not over");
    if (room.ownerId !== me.id) fail("owner only");

    cancelSession(room);
    room.players.forEach(resetPlayerForLobby);
    room.log = [];
    room.game = {phase: "lobby", turn: 1, activePlayerId: null};

    commit();
    emitRoomLog(io, room);
  });
}
