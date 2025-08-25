import {Server} from "socket.io";

const PORT = Number(process.env.PORT ?? 3001);
const io = new Server(PORT, {
    cors: {origin: "http://localhost:5173", credentials: true}
});

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);
    socket.emit("Server:test message", {id: socket.id, ts: Date.now() });
    socket.on("disconnect", (reason) => {
        console.log("Disconnected:", socket.id, reason);
    });
});

console.log(`Socket.io server listening on ws://localhost:${PORT}`);