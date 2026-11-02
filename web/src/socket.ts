import { io, Socket } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

export function makeSocket(): Socket {
  //keeps retrying for as long as the tab is open, since a held seat can be reclaimed for minutes
  const socket = io(API_URL, {
    transports: ["websocket"],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    timeout: 20000,
  });

  if (import.meta.env.DEV) {
    socket.onAny((event, ...args) => {
      console.debug("[socket]", event, ...args);
    });
  }

  return socket;
}
