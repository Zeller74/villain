import type { z } from "zod";
import { emitRoomLog, emitRoomState, type GameIo, type GameSocket } from "../game/broadcast";
import { fail, GameError } from "../game/errors";
import { appendLog } from "../game/log";
import { getPlayer, rooms } from "../game/rooms";
import { canAct } from "../game/turns";
import type { EventName, Payload, Result } from "../protocol";
import type { ActionData, Player, Room } from "../types";
import { schemas } from "./schemas";

//what a player must be for an event to run: in a room, or further along
export type Requirement = "seated" | "lobby" | "playing" | "action";

type PublicCtx<E extends EventName> = {io: GameIo; socket: GameSocket; payload: Payload<E>};
type SeatedCtx<E extends EventName> = PublicCtx<E> & {
  room: Room;
  me: Player;
  //broadcasts the new state, logging an action if given one
  commit: (action?: ActionData) => void;
};

export type Binder = {
  onPublic: <E extends EventName>(event: E, run: (ctx: PublicCtx<E>) => Result<E>) => void;
  on: <E extends EventName>(event: E, requires: Requirement, run: (ctx: SeatedCtx<E>) => Result<E>) => void;
};

function loadSeat(socket: GameSocket, requires: Requirement) {
  const {roomId, playerId} = socket.data;
  if (!roomId || !playerId) fail("not in a room");
  const room = rooms.get(roomId) ?? fail("room not found");
  const me = getPlayer(room, playerId);

  if (requires === "lobby" && room.game.phase !== "lobby") fail("not in lobby");
  if ((requires === "playing" || requires === "action") && room.game.phase !== "playing") fail("game not started");
  if (requires === "action" && !canAct(room, me)) fail("not your turn");
  return {room, me};
}

//every client event goes through here, so nothing a client sends can throw past this
//point: the ack may be missing, the payload is validated, and any failure becomes a reply
export function createBinder(io: GameIo, socket: GameSocket): Binder {
  const listen = <E extends EventName>(event: E, run: (payload: Payload<E>) => Result<E>) => {
    const schema: z.ZodType = schemas[event];
    const listener = (...args: unknown[]) => {
      const last = args[args.length - 1];
      const ack = typeof last === "function" ? (args.pop() as (res: unknown) => void) : () => {};
      try {
        const parsed = schema.safeParse(args[0]);
        if (!parsed.success) return ack({ok: false, error: "bad input"});
        const result = run(parsed.data as Payload<E>) as object | undefined;
        ack({ok: true, ...result});
      } catch (err) {
        if (err instanceof GameError) return ack({ok: false, error: err.message});
        console.error(`handler failed: ${event}`, err);
        ack({ok: false, error: "server error"});
      }
    };
    socket.on(event, listener as never);
  };

  return {
    onPublic: (event, run) => listen(event, (payload) => run({io, socket, payload})),
    on: (event, requires, run) => listen(event, (payload) => {
      const {room, me} = loadSeat(socket, requires);
      const commit = (action?: ActionData) => {
        if (action) appendLog(room, me, action);
        emitRoomState(io, room);
        if (action) emitRoomLog(io, room);
      };
      return run({io, socket, payload, room, me, commit});
    }),
  };
}
