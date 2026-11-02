import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { Ack, Card, CharacterPreview, ChatMsg, EventName, LogItem, Payload, Pending, Result, RoomState, Seat, SelfState } from "./protocol";
import { clearSeat, loadSeat, saveSeat } from "./seat";
import { makeSocket } from "./socket";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
export type Call = <E extends EventName>(event: E, payload: Payload<E>, onOk?: (res: Result<E>) => void) => void;
export type GameClient = ReturnType<typeof useGameClient>;

const ERROR_MS = 2200;

const invitedRoom = () => new URLSearchParams(window.location.search).get("room")?.trim() || null;

//owns the socket and everything the server tells us. Screens read from this and send through `call`
export function useGameClient() {
  const socketRef = useRef<Socket | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [myId, setMyId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [catalog, setCatalog] = useState<CharacterPreview[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [invitedRoomId, setInvitedRoomId] = useState(invitedRoom);

  const forgetRoom = useCallback(() => {
    setRoom(null);
    setMyId(null);
    setHand([]);
    setPending(null);
    setMessages([]);
    setLogItems([]);
  }, []);

  useEffect(() => {
    const s = makeSocket();
    socketRef.current = s;

    s.on("connect", () => {
      setStatus("connected");
      s.emit("meta:getCharacters", {}, (res: Ack<Result<"meta:getCharacters">>) => {
        if (res.ok) setCatalog(res.characters);
        else setLastError(res.error);
      });

      //an invite to a different room wins over an old seat
      const saved = loadSeat();
      const invited = invitedRoom();
      if (!saved || (invited && invited !== saved.seat.roomId)) return;
      const {roomId, token} = saved.seat;
      s.emit("room:resume", {roomId, token, takeOver: saved.ownTab}, (res: Ack<Seat>) => {
        if (res.ok) {
          saveSeat(res);
          setMyId(res.playerId);
          return;
        }
        //someone is still sitting there, so this tab is simply a new player
        if (res.error === "seat in use") return;
        clearSeat();
        forgetRoom();
        setLastError("That game is no longer available.");
      });
    });

    s.on("disconnect", (reason) => {
      setStatus("disconnected");
      //the server dropped us on purpose, which only happens when this seat opened elsewhere
      if (reason === "io server disconnect") {
        clearSeat();
        forgetRoom();
        setLastError("This game was opened somewhere else.");
        s.connect();
      }
    });

    s.on("room:state", (state: RoomState) => setRoom(state));
    s.on("room:self", (self: SelfState) => {
      setHand(self.hand);
      setPending(self.pending);
    });
    s.on("room:log", (payload: {items: LogItem[]}) => setLogItems(payload.items));
    s.on("chat:history", (payload: {messages: ChatMsg[]}) => setMessages(payload.messages));
    s.on("chat:msg", (payload: {msg: ChatMsg}) => setMessages((prev) => [...prev, payload.msg]));

    return () => {
      s.close();
    };
  }, [forgetRoom]);

  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(() => setLastError(null), ERROR_MS);
    return () => clearTimeout(t);
  }, [lastError]);

  const call = useCallback<Call>((event, payload, onOk) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setLastError("Not connected");
      return;
    }
    socket.emit(event, payload, (res: Ack<Result<typeof event>>) => {
      if (res.ok) onOk?.(res as Result<typeof event>);
      else setLastError(res.error);
    });
  }, []);

  const enterSeat = useCallback((seat: Seat) => {
    saveSeat(seat);
    setMyId(seat.playerId);
  }, []);

  const createRoom = useCallback((name: string) => {
    call("room:create", {name}, enterSeat);
  }, [call, enterSeat]);

  const joinRoom = useCallback((roomId: string, name: string) => {
    call("room:join", {roomId, name}, enterSeat);
  }, [call, enterSeat]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave", {});
    clearSeat();
    forgetRoom();
    setInvitedRoomId(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, [forgetRoom]);

  return {
    status,
    myId,
    room,
    hand,
    pending,
    messages,
    logItems,
    catalog,
    lastError,
    setLastError,
    invitedRoomId,
    call,
    createRoom,
    joinRoom,
    leaveRoom,
  };
}
