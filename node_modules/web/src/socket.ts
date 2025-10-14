import { io, Socket } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export function makeSocket(): Socket {
  const socket = io(API_URL, {
    transports: ["websocket"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 20000,
  });

  if (import.meta.env.DEV) {
    socket.onAny((event, ...args) => {
      console.debug("[socket]", event, ...args);
    });
  }

  return socket;
}
