import {Server} from "socket.io";
import {nanoid} from "nanoid";

type Player = {id: string; name: string};
type Room = {id: string; players: Player[]};

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
        const room: Room = { id: roomId, players: [] };
        rooms.set(roomId, room);

        //join as player
        const player: Player = { id: socket.id, name };
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
            room.players.push({ id: socket.id, name });
        }

        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.name   = name;

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        console.log(`${name} (${socket.id}) joined room ${roomId}`);
    });
});

console.log(`Socket.io server listening on ws://localhost:${PORT}`);