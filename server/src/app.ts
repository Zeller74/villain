import { createServer } from "node:http";
import { Server } from "socket.io";
import type { GameIo } from "./game/broadcast";
import { handleDisconnect, type GraceTimes } from "./game/rooms";
import { createBinder } from "./handlers/binder";
import { registerBoardHandlers } from "./handlers/board";
import { registerCharacterHandlers } from "./handlers/character";
import { registerFateHandlers } from "./handlers/fate";
import { registerGameHandlers } from "./handlers/game";
import { registerLobbyHandlers } from "./handlers/lobby";
import { registerRoomHandlers } from "./handlers/room";

const MINUTE = 60_000;

//how long a dropped player keeps their seat before they are removed
const DEFAULT_GRACE: GraceTimes = {lobbyMs: 0.5 * MINUTE, gameMs: 5 * MINUTE};

//largest single message a client may send. The biggest real one is a short list of card ids
const MAX_MESSAGE_BYTES = 16_000;

type Options = {corsOrigins: string[]; grace?: GraceTimes};

export function createGameServer({corsOrigins, grace = DEFAULT_GRACE}: Options) {
  const httpServer = createServer((req, res) => {
    res.writeHead(req.url === "/healthz" ? 200 : 404);
    res.end();
  });

  const io: GameIo = new Server(httpServer, {
    cors: {origin: corsOrigins, credentials: true},
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
  });

  io.on("connection", (socket) => {
    socket.data = {roomId: null, playerId: null};
    socket.on("disconnect", () => handleDisconnect(io, socket, grace));

    const binder = createBinder(io, socket);
    registerRoomHandlers(binder);
    registerLobbyHandlers(binder);
    registerGameHandlers(binder);
    registerBoardHandlers(binder);
    registerFateHandlers(binder);
    registerCharacterHandlers(binder);
  });

  return {httpServer, io};
}
