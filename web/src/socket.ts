import {io, Socket} from "socket.io-client";

export function makeSocket(): Socket {
    const socket = io("http://localhost:3001", {
        transports: ["websocket"],
    });

    if (import.meta.env.DEV){
        socket.onAny((event, ...args) =>{
            console.debug("[socket]", event, ...args);
        });
    }
    return socket;
}