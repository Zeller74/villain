import {Server} from "socket.io";
import {nanoid} from "nanoid";
import { measureMemory } from "vm";

type Location = {id: string; name: string; bottom: Card[]; top: Card[]; locked?: boolean};
type Board = {moverAt: 0 | 1 | 2 | 3; locations: [Location, Location, Location, Location]}
type Card = {id: string; label: string; faceUp: boolean};
type Zones = {deck: Card[]; hand: Card[]; board: Card[]; discard: Card[]};
type Player = {id: string; name: string, ready: boolean; characterId: string | null; zones: Zones; board: Board;};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string;}
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type Room = {id: string; ownerId: string; players: Player[]; game: GameMeta; messages: ChatMsg[]};

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
        players: room.players,
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
        const room: Room = { id: roomId, ownerId: socket.id, players: [] , game: {phase: "lobby", turn: 1, activePlayerId: null}, messages: []};
        rooms.set(roomId, room);

        //join as player
        const player: Player = { id: socket.id, name, ready: false, characterId: null, zones: {deck: [], hand:[], board: [], discard: []}, board: makeEmptyBoard() };
        room.players.push(player);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.name   = name;

        ack?.({ ok: true, roomId });
        emitRoomState(io, roomId);
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
            room.players.push({id: socket.id, name, ready: false, characterId: null, zones: {deck: [], hand: [], board: [], discard: []}, board: makeEmptyBoard()});
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

        // only active player draws (simple rule for now)
        if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
        }

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        const n = Math.max(1, Math.min(5, Number(payload?.count ?? 1))); // 1..5 safeguard
        for (let i = 0; i < n; i++) {
        const card = me.zones.deck.pop(); // top = end of array
        if (!card) break;
        me.zones.hand.push({ ...card, faceUp: true }); // hand is private; faceUp can be true for you
        }

        ack?.({ ok: true });
        emitRoomState(io, roomId); // will also send room:self to you 
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
        });
});

console.log(`Socket.io server listening on ws://localhost:${PORT}`);