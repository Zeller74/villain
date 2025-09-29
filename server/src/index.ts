import {Server} from "socket.io";
import {nanoid} from "nanoid";
import { measureMemory } from "vm";

type Location = {id: string; name: string; bottom: Card[]; top: Card[]; locked?: boolean};
type Board = {moverAt: 0 | 1 | 2 | 3; locations: [Location, Location, Location, Location]}
type Card = {id: string; label: string; faceUp: boolean};
type Zones = {deck: Card[]; hand: Card[]; discard: Card[]};
type Player = {id: string; name: string, ready: boolean; characterId: string | null; zones: Zones; board: Board;};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string;}
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type Room = {id: string; ownerId: string; players: Player[]; game: GameMeta; messages: ChatMsg[]; log: ActionEntry[]};
type ActionType = "draw" | "play" | "discard" | "undo" | "move" | "remove" | "reshuffle";
type ActionEntry = {
  id: string;
  ts: number;
  actorId: string;
  type: ActionType;
  data:
    | { type: "draw"; cardIds: string[] }
    | { type: "play"; cardId: string; locationIndex: 0|1|2|3 }
    | { type: "discard"; cardIds: string[] }
    | { type: "undo"; actionId: string }
    | { type: "move"; cardId: string; from: 0|1|2|3; to: 0|1|2|3; fromIndex: number; toIndex: number }
    | { type: "remove"; cardId: string; from: 0|1|2|3; fromIndex: number }
    | { type: "reshuffle"; moved: number};
  undone?: boolean;
  
};
type LogItem = {id: string; ts: number; actorId: string; actorName: string; type: ActionType | "undo"; text: string}

const PORT = Number(process.env.PORT ?? 3001);
const io = new Server(PORT, {
    cors: {origin: "http://localhost:5173", credentials: true}
});
const rooms = new Map<string, Room>();

function newRoomId(){
    return nanoid(6);
}

function isOwner(socket: any, room: Room){
    return socket.id === room.ownerId;
}

function allReady(room: Room){
    return room.players.length >= 1 && room.players.every(p => p.ready);
}

function emitRoomState(io: Server, roomId: string){
    const room = rooms.get(roomId);
    if (!room) return;
    const publicPlayers = room.players.map(p => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        characterId: p.characterId,
        //public zones: counts only for hidden zones, full list for board
        counts: {
            deck: p.zones.deck.length,
            hand: p.zones.hand.length,
            discard: p.zones.discard.length,
        },
        discardTop: p.zones.discard.length ? p.zones.discard[p.zones.discard.length - 1] : null,
        board: {
            moverAt: p.board.moverAt,
            locations: p.board.locations.map(loc => ({
                id: loc.id,
                name: loc.name,
                locked: !!loc.locked,
                top: loc.top,       // public
                bottom: loc.bottom, // public
            })),
        },
    }));
    io.to(roomId).emit("room:state", {
        roomId: room.id,
        ownerId: room.ownerId,
        players: publicPlayers,
        game: room.game,
    });
    emitPrivateStates(io, roomId);
}

function emitPrivateStates(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.in(roomId).fetchSockets().then(sockets => {
    for (const s of sockets) {
      const me = room.players.find(p => p.id === s.id);
      if (!me) continue;
      s.emit("room:self", {
        roomId: room.id,
        hand: me.zones.hand,
        counts: {
          deck: me.zones.deck.length,
          hand: me.zones.hand.length,
          discard: me.zones.discard.length,
        }
      });
    }
  }).catch(() => {});
}

function leaveCurrentRoom(socket: any, io: Server, opts?: { reason?: string }) {
  const roomId = socket.data.roomId as string | null;
  if (!roomId) { socket.data.roomId = null; return; }

  const room = rooms.get(roomId);
  if (!room) { socket.data.roomId = null; return; }

  //remove player
  room.players = room.players.filter(p => p.id !== socket.id);

  //system message
  const text = `${socket.data.name ?? "Player"} disconnected${opts?.reason ? ` (${opts.reason})` : ""}.`;
  const sys: ChatMsg = { id: nanoid(8), ts: Date.now(), playerId: "system", name: "System", text };
  room.messages.push(sys);
  room.messages = room.messages.slice(-100);
  io.to(roomId).emit("chat:msg", { roomId, msg: sys });

  if (room.players.length === 0) {
    rooms.delete(roomId);
    console.log(`🧹 room ${roomId} deleted (empty)`);
  } else {
    //owner handoff
    if (room.ownerId === socket.id) {
        const first = room.players[0]
        if (first){
            room.ownerId = first.id;
        }
    }
    //active player handoff
    if (room.game.activePlayerId === socket.id) {
      const first = room.players[0];
      room.game.activePlayerId = first ? first.id : null;
    }
    emitRoomState(io, roomId);
  }

  socket.leave(roomId);
  socket.data.roomId = null;
}

function makeLocation(ix: number, label?: string): Location {
  return {
    id: nanoid(6),
    name: label ?? `Loc ${ix + 1}`,
    bottom: [],
    top: [],
    locked: false,
  };
}

function makeEmptyBoard(): Board {
  return {
    moverAt: 0,
    locations: [0,1,2,3].map(i => makeLocation(i)) as Board["locations"],
  };
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function makeStarterDeck(ownerName: string, n = 15): Card[] {
  const cards: Card[] = [];
  for (let i = 1; i <= n; i++) {
    cards.push({
      id: `${nanoid(8)}`,
      label: `${ownerName} ${i}`, //placeholder
      faceUp: false
    });
  }
  shuffle(cards);
  return cards;
}

function reshuffleFromDiscardIntoDeck(p: Player): boolean {
  if (p.zones.deck.length > 0) return false;
  if (p.zones.discard.length === 0) return false;
  //move all discard to deck, face down, then shuffle
  p.zones.deck = p.zones.discard.splice(0).map(c => ({ ...c, faceUp: false }));
  shuffle(p.zones.deck);
  return true;
}

function buildLogItem(room: Room, e: ActionEntry): LogItem {
  const actor = room.players.find(p => p.id === e.actorId);
  const name = actor?.name ?? e.actorId.slice(0, 6);

  if (e.undone) {
    return {
      id: e.id,
      ts: e.ts,
      actorId: e.actorId,
      actorName: name,
      type: "undo",
      text: `${name} undid their last action`,
    };
  }

  if (e.type === "draw" && e.data.type === "draw") {
    const n = e.data.cardIds.length;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "draw",
      text: `${name} drew ${n} card${n === 1 ? "" : "s"}`
    };
  }

  if (e.type === "play" && e.data.type === "play") {
    const k = e.data.locationIndex + 1;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "play",
      text: `${name} played a card to L${k}`
    };
  }

  if (e.type === "discard" && e.data.type === "discard") {
    const n = e.data.cardIds.length;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "discard",
      text: `${name} discarded ${n} card${n === 1 ? "" : "s"}`
    };
  }

  if (e.type === "undo" && e.data.type === "undo") {
    return { id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "undo",
      text: `${name} undid their last action` };
  }
  if (e.type === "move" && e.data.type === "move") {
    const from = e.data.from + 1;
    const to = e.data.to + 1;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "move",
      text: `${name} moved a card L${from} → L${to}`,
    };
  }
  if (e.type === "remove" && e.data.type === "remove") {
    const from = e.data.from + 1;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "remove",
      text: `${name} discarded a board card from L${from}`,
    };
  }
  if (e.type === "reshuffle" && e.data.type === "reshuffle") {
    const n = e.data.moved;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "reshuffle",
      text: `${name} reshuffled ${n} card${n===1 ? "" : "s"} into deck`,
    };
  }

  //fallback
  return {
    id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: e.type,
    text: `${name} did ${e.type}`
  };
}

function emitRoomLog(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  // Broadcast a sanitized view (most recent first)
  const items: LogItem[] = room.log.slice(-25).map(e => buildLogItem(room, e)).reverse();
  io.to(roomId).emit("room:log", { items });
}

// append and broadcast (cap length to keep memory bounded)
function pushLog(io: Server, roomId: string, entry: ActionEntry) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.log.push(entry);
  if (room.log.length > 25) room.log.splice(0, room.log.length - 25);
  emitRoomLog(io, roomId);
}

function shuffleDiscardIntoDeck(p: Player): number {
  const moved = p.zones.discard.length;
  if (moved === 0) return 0;
  const movedCards = p.zones.discard.splice(0).map(c => ({ ...c, faceUp: false }));
  p.zones.deck.push(...movedCards);   // append to existing deck
  shuffle(p.zones.deck);              // shuffle whole deck
  return moved;
}




io.on("connection", (socket) => {
    console.log("Connected:", socket.id);
    socket.emit("Server:test message", {id: socket.id, ts: Date.now() });
    socket.on("disconnect", (reason) => {
        leaveCurrentRoom(socket, io, { reason: "disconnect" });
        console.log("Disconnected:", socket.id, reason);
    });
    socket.data.roomId = null as null | string;
    socket.data.name = null as null | string;
    //create a new room, autojoin, and ack with roomId
    socket.on("room:create", (payload: { name: string }, ack?: (res: { ok: boolean; roomId?: string; error?: string }) => void) => {
        const name = (payload?.name ?? "").trim();
        if (!name) {
            ack?.({ ok: false, error: "name required" });
            return;
        }
        if (socket.data.roomId) {
            leaveCurrentRoom(socket, io, { reason: "switching rooms" });
        }


        //make a new room
        const roomId = newRoomId();
        const room: Room = { id: roomId, ownerId: socket.id, players: [] , game: {phase: "lobby", turn: 1, activePlayerId: null}, messages: [], log: []};
        rooms.set(roomId, room);

        //join as player
        const player: Player = { id: socket.id, name, ready: false, characterId: null, zones: {deck: [], hand:[], discard: []}, board: makeEmptyBoard() };
        room.players.push(player);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.name   = name;

        ack?.({ ok: true, roomId });
        emitRoomState(io, roomId);
        emitRoomLog(io, room.id);
        console.log(`Room ${roomId} created by ${name} (${socket.id})`);
    });
    //join by id
    socket.on("room:join", (payload: { roomId: string; name: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = (payload?.roomId ?? "").trim();
        const name   = (payload?.name ?? "").trim();
        const room   = rooms.get(roomId);
        if (!room) {
            ack?.({ ok: false, error: "room not found" });
            return;
        }
        if (!name) {
            ack?.({ ok: false, error: "name required" });
            return;
        }
        //avoid dupes
        if (!room.players.some(p => p.id === socket.id)) {
            room.players.push({id: socket.id, name, ready: false, characterId: null, zones: {deck: [], hand: [], discard: []}, board: makeEmptyBoard()});
            if (!room.game.activePlayerId && room.players.length > 0) {
                const first = room.players[0]
                if (first) room.game.activePlayerId = first.id;
            }
        }
        if (socket.data.roomId && socket.data.roomId !== roomId) {
            leaveCurrentRoom(socket, io, { reason: "switching rooms" });
        }


        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.name   = name;
        socket.emit("chat:history", {
            roomId,
            messages: room.messages
        });

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        emitRoomLog(io, room.id);
        console.log(`${name} (${socket.id}) joined room ${roomId}`);
    });
    socket.on("room:leave", (ack?: (res:{ok:boolean; error?:string})=>void) => {
        leaveCurrentRoom(socket, io, { reason: "left room" });
        ack?.({ ok: true });
    });
    socket.on("chat:send", (payload: {text: string}, ack?: (res: { ok: boolean; error?: string}) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        const raw = (payload?.text ?? "").trim();
        if (!raw) return ack?.({ ok: false, error: "empty message" });

        const text = raw.slice(0, 300);
        const msg: ChatMsg = {
        id: nanoid(8),
        ts: Date.now(),
        playerId: socket.id,
        name: socket.data.name ?? "Anonymous",
        text
        };

        room.messages.push(msg);
        //only last 100 msgs
        if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
        }

        io.to(roomId).emit("chat:msg", { roomId, msg });

        ack?.({ ok: true });
    });
    socket.on("lobby:chooseCharacter",(payload: { characterId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "lobby") return ack?.({ ok: false, error: "not in lobby" });

        const c = (payload?.characterId ?? "").trim().slice(0, 40);
        if (!c) return ack?.({ ok: false, error: "character required" });

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        me.characterId = c;
        ack?.({ ok: true });
        emitRoomState(io, roomId);

        // optional: system message
        const sys: ChatMsg = { id: nanoid(8), ts: Date.now(), playerId: "system", name: "System", text: `${me.name} chose ${c}` };
        room.messages.push(sys); room.messages = room.messages.slice(-100);
        io.to(roomId).emit("chat:msg", { roomId, msg: sys });
    });
    socket.on("lobby:setReady",(payload: { ready: boolean }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "lobby") return ack?.({ ok: false, error: "not in lobby" });

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        me.ready = !!payload?.ready;
        ack?.({ ok: true });
        emitRoomState(io, roomId);
    });
    socket.on("lobby:start",(ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "lobby") return ack?.({ ok: false, error: "already started" });
        if (!isOwner(socket, room)) return ack?.({ ok: false, error: "owner only" });
        if (room.players.length < 2) return ack?.({ ok: false, error: "need at least 2 players" });
        if (!allReady(room)) return ack?.({ ok: false, error: "not all ready" });

        for (const p of room.players) {
            p.zones.deck = makeStarterDeck(p.name, 15);
            p.zones.hand = [];
            p.zones.discard = [];
            // reset / label board for the run (keeps ids stable)
            p.board = makeEmptyBoard();
            // if (p.characterId === 'warlord') { p.board.locations[0].name = 'camp'; ... }
        }

        //transition to playing
        room.game.phase = "playing";
        room.game.turn = 1;
        const first = room.players[0];
        room.game.activePlayerId = first ? first.id : null;

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        emitRoomLog(io, room.id);
        //\system message
        const sys: ChatMsg = { id: nanoid(8), ts: Date.now(), playerId: "system", name: "System", text: "Game started!" };
        room.messages.push(sys); room.messages = room.messages.slice(-100);
        io.to(roomId).emit("chat:msg", { roomId, msg: sys });
    });
    socket.on("game:endTurn", (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });

        //only the active player can end turn
        if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
        }

        const ps = room.players;
        if (ps.length === 0) return ack?.({ ok: false, error: "no players" });

        //rotate to next player
        const idx = ps.findIndex(p => p.id === socket.id);
        if (idx === -1) return ack?.({ ok: false, error: "player not in room" });

        const nextIdx = (idx + 1) % ps.length;
        const nextPlayer = ps[nextIdx];
        if (!nextPlayer) return ack?.({ok: false, error: "next player missing"});
        
        const wrapped = nextIdx === 0;
        room.game.activePlayerId = nextPlayer.id;
        if (wrapped) room.game.turn += 1;

        ack?.({ ok: true });
        emitRoomState(io, roomId);
    });
    socket.on("game:draw", (payload: {count?: number} | undefined, ack?: (res: {ok: boolean; error?: string}) => void) =>{
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

        if (room.game.activePlayerId !== socket.id) {
          return ack?.({ ok: false, error: "not your turn" });
        }

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        const n = Math.max(1, Math.min(5, Number(payload?.count ?? 1)));
        const drawnIds: string[] = [];  // collect while drawing
        for (let i = 0; i < n; i++) {
          if (me.zones.deck.length === 0) reshuffleFromDiscardIntoDeck(me);
          const card = me.zones.deck.pop();
          if (!card) break;
          const c = { ...card, faceUp: true };
          me.zones.hand.push(c);
          drawnIds.push(c.id);
        }
        ack?.({ ok: true });
        emitRoomState(io, roomId);
        pushLog(io, roomId, {
          id: nanoid(8),
          ts: Date.now(),
          actorId: socket.id,
          type: "draw",
          data: { type: "draw", cardIds: drawnIds },
        });
    });
    socket.on("game:playToLocation", (payload: {cardId: string; locationIndex: number}, ack?: (res: {ok: boolean; error?: string}) => void) =>{
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
        //only active player can play
        if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
        }
        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        const k = Number(payload?.locationIndex);
        if (!(k >= 0 && k < 4)) return ack?.({ ok: false, error: "bad location index" });

        const idx = me.zones.hand.findIndex(c => c.id === payload.cardId);
        if (idx === -1) return ack?.({ ok: false, error: "card not in hand" });
    
        //move card from hand to board
        const card = me.zones.hand.splice(idx, 1)[0]!;
        card.faceUp = true;

        const kk = (k as 0 | 1 | 2 | 3);
        const loc = me.board.locations[kk];
        if(!loc) return ack?.({ok: false, error: "bad location"});
        loc.bottom.push(card);

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        pushLog(io, roomId, {
          id: nanoid(8),
          ts: Date.now(),
          actorId: socket.id,
          type: "play",
          data: { type: "play", cardId: card.id, locationIndex: k as 0|1|2|3 },
        });
    });
    socket.on("game:discard", (payload: {cardId?: string; cardIds?: string[]} | undefined, ack?: (res: {ok: boolean; error?: string; discarded?: number}) => void) =>{
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      //only active player can discard
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      //normalize payload to an array of ids
      const ids = (payload?.cardIds && payload.cardIds.length > 0) ? payload.cardIds : (payload?.cardId ? [payload.cardId] : []);

      if (ids.length === 0) return ack?.({ ok: false, error: "no cards specified" });

      let count = 0;
      for (const id of ids) {
        const idx = me.zones.hand.findIndex(c => c.id === id);
        if (idx === -1) continue; //skip unknown
        const card = me.zones.hand.splice(idx, 1)[0]!;
        card.faceUp = true;
        me.zones.discard.push(card);
        count++;
      }

      if (count === 0) return ack?.({ ok: false, error: "card(s) not in hand" });

      ack?.({ ok: true, discarded: count });
      emitRoomState(io, roomId); //public counts + your private hand via room:self
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "discard",
        data: { type: "discard", cardIds: ids },
      });
    });
    socket.on("pile:getDiscard", (payload: {playerId: string}, ack?: (res: {ok: boolean; error?: string; cards?: Card[]}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });

      const pid = (payload?.playerId || "").trim();
      const target = room.players.find(p => p.id === pid);
      if (!target) return ack?.({ ok: false, error: "player not found" });

      // Discard is public. Return top-first ordering.
      const cards = target.zones.discard.slice().reverse();
      ack?.({ ok: true, cards });
    });
    socket.on("game:moveCard", (payload: {cardId: string; from: number; to: number}, ack?: (res: {ok: boolean; error?: string}) => void) =>{
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const from = Number(payload?.from);
      const to = Number(payload?.to);
      if (!(from >= 0 && from < 4) || !(to >= 0 && to < 4)) {
        return ack?.({ ok: false, error: "bad location index" });
      }
      if (from === to) {
        return ack?.({ ok: false, error: "moving within same location not supported yet" });
      }

      const fromLoc = me.board.locations[from];
      const toLoc = me.board.locations[to];
      if (!fromLoc || !toLoc) return ack?.({ ok: false, error: "bad locations" });

      const idx = fromLoc.bottom.findIndex(c => c.id === payload.cardId);
      if (idx === -1) return ack?.({ ok: false, error: "card not in source location (bottom)" });

      const card = fromLoc.bottom.splice(idx, 1)[0]!;
      const toIndex = toLoc.bottom.length; // push to end for now
      toLoc.bottom.push(card);

      ack?.({ ok: true });
      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "move",
        data: { type: "move", cardId: card.id, from: from as 0|1|2|3, to: to as 0|1|2|3, fromIndex: idx, toIndex },
      });
    });
    socket.on("log:undoSelf", (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      const last = room.log[room.log.length - 1];
      if (!last) return ack?.({ ok: false, error: "nothing to undo" });
      if (last.actorId !== socket.id) return ack?.({ ok: false, error: "only your last action can be undone" });
      if (last.undone) return ack?.({ ok: false, error: "already undone" });

      const me = room.players.find(p => p.id === socket.id)!;
      if (last.type === "reshuffle" && last.data.type === "reshuffle") {
        return ack?.({ ok: false, error: "reshuffle cannot be undone" });
      }
      if (last.type === "draw" && last.data.type === "draw") {
        const ids = last.data.cardIds;
        if (!ids.every(id => me.zones.hand.some(c => c.id === id))) {
          return ack?.({ ok: false, error: "cannot undo: cards already moved" });
        }
        for (let i = ids.length - 1; i >= 0; i--) {
          const id = ids[i];
          const idx = me.zones.hand.findIndex(c => c.id === id);
          const card = me.zones.hand.splice(idx, 1)[0]!;
          card.faceUp = false;
          me.zones.deck.push(card);
        }
      } else if (last.type === "play" && last.data.type === "play") {
        const { cardId, locationIndex } = last.data;
        const loc = me.board.locations[locationIndex];
        if (!loc) return ack?.({ ok: false, error: "bad location" });
        const idx = loc.bottom.findIndex(c => c.id === cardId);
        if (idx === -1) return ack?.({ ok: false, error: "card not on board anymore" });
        const card = loc.bottom.splice(idx, 1)[0]!;
        me.zones.hand.push(card);
      } else if (last.type === "discard" && last.data.type === "discard") {
        const ids = last.data.cardIds;
        for (let i = ids.length - 1; i >= 0; i--) {
          const id = ids[i];
          const top = me.zones.discard[me.zones.discard.length - 1];
          if (!top || top.id !== id) {
            return ack?.({ ok: false, error: "cannot undo: discard changed" });
          }
          const card = me.zones.discard.pop()!;
          me.zones.hand.push(card);
        }
      } else if (last.type === "move" && last.data.type === "move") {
        const { cardId, from, to, fromIndex } = last.data;
        const toLoc = me.board.locations[to];
        const fromLoc = me.board.locations[from];
        if (!toLoc || !fromLoc) return ack?.({ ok: false, error: "bad locations" });

        const j = toLoc.bottom.findIndex(c => c.id === cardId);
        if (j === -1) return ack?.({ ok: false, error: "card not in destination anymore" });

        const card = toLoc.bottom.splice(j, 1)[0]!;
        const insertAt = Math.min(Math.max(0, fromIndex), fromLoc.bottom.length);
        fromLoc.bottom.splice(insertAt, 0, card);
      } else if (last.type === "remove" && last.data.type === "remove") {
        const { cardId, from, fromIndex } = last.data;
        const fromLoc = me.board.locations[from];
        if (!fromLoc) return ack?.({ ok: false, error: "bad location" });

        const top = me.zones.discard[me.zones.discard.length - 1];
        if (!top || top.id !== cardId) {
          return ack?.({ ok: false, error: "cannot undo: discard changed" });
        }
        const card = me.zones.discard.pop()!;
        const insertAt = Math.min(Math.max(0, fromIndex), fromLoc.bottom.length);
        fromLoc.bottom.splice(insertAt, 0, card);
      } else {
        return ack?.({ ok: false, error: "unsupported undo" });
      }

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "undo",
        data: { type: "undo", actionId: last.id },
      });

      ack?.({ ok: true });
    });
    socket.on("game:removeCard", (payload: {cardId: string; from: number}, ack?: (res: {ok: boolean; error?: string}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const from = Number(payload?.from);
      if (!(from >= 0 && from < 4)) return ack?.({ ok: false, error: "bad location index" });

      const fromLoc = me.board.locations[from];
      if (!fromLoc) return ack?.({ ok: false, error: "bad location" });
      const idx = fromLoc.bottom.findIndex(c => c.id === payload.cardId);
      if (idx === -1) return ack?.({ ok: false, error: "card not on that location (bottom)" });

      const card = fromLoc.bottom.splice(idx, 1)[0]!;
      card.faceUp = true;
      me.zones.discard.push(card);

      ack?.({ ok: true });
      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "remove",
        data: { type: "remove", cardId: card.id, from: from as 0|1|2|3, fromIndex: idx },
      });
    });
    socket.on("game:reshuffleDeck", (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const moved = shuffleDiscardIntoDeck(me);
      if (moved === 0) return ack?.({ ok: false, error: "discard is empty" });

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "reshuffle",
        data: { type: "reshuffle", moved },
      });

      ack?.({ ok: true });
    });

    

});

console.log(`Socket.io server listening on ws://localhost:${PORT}`);