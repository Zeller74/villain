import {Server} from "socket.io";
import {nanoid} from "nanoid";

type Player = {id: string; name: string};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string;}
type GameMeta = {turn: number; activePlayerId: string | null};
type Room = {id: string; players: Player[]; game: GameMeta; messages: ChatMsg[]};

const PORT = Number(process.env.PORT ?? 3001);
const io = new Server(PORT, {
    cors: {origin: "http://localhost:5173", credentials: true}
});
const rooms = new Map<string, Room>();

function newRoomId(){
    return nanoid(6);
}

function emitRoomState(io: Server, roomId: string){
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit("room:state", {
        roomId: room.id,
        players: room.players,
        game: room.game,
    });
}

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);
    socket.emit("Server:test message", {id: socket.id, ts: Date.now() });
    socket.on("disconnect", (reason) => {
        const roomId = socket.data.roomId as string | null;
        const name   = socket.data.name as string | null;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId)!;
            room.players = room.players.filter(p => p.id !== socket.id);

            //empty room
            if (room.players.length === 0) {
                rooms.delete(roomId);
                console.log(`room ${roomId} deleted`);
            } else {
                //active player leaves
                if (room.game.activePlayerId === socket.id) {
                    //choose the first player left
                    const first = room.players[0]
                    room.game.activePlayerId = first ? first.id : null;
                }
                emitRoomState(io, roomId);
            }
        }
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
        //make a new room
        const roomId = newRoomId();
        const room: Room = { id: roomId, players: [] , game: {turn: 1, activePlayerId: null}, messages: []};
        rooms.set(roomId, room);

        //join as player
        const player: Player = { id: socket.id, name };
        room.players.push(player);
        if(!room.game.activePlayerId){
            room.game.activePlayerId = player.id;
        }
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
            room.players.push({id: socket.id, name});
            if (!room.game.activePlayerId && room.players.length > 0) {
                const first = room.players[0]
                if (first) room.game.activePlayerId = first.id;
            }

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
});

console.log(`Socket.io server listening on ws://localhost:${PORT}`);