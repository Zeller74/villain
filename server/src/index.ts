import { createGameServer } from "./app";

const PORT = Number(process.env.PORT ?? 3001);
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173"];

createGameServer({corsOrigins}).httpServer.listen(PORT, () => {
  console.log(`Socket.io server listening on ws://localhost:${PORT}`);
});
