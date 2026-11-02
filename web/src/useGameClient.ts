import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { Ack, Card, CharacterPreview, ChatMsg, EventName, LogItem, Payload, Pending, Result, RoomState, Seat, SelfState } from "./protocol";
import { forgetSeat, loadBrowserSeats, loadTabSeat, releaseTabSeat, saveSeat } from "./seat";
import { makeSocket } from "./socket";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
export type Call = <E extends EventName>(event: E, payload: Payload<E>, onOk?: (res: Result<E>) => void) => void;
export type GameClient = ReturnType<typeof useGameClient>;

const ERROR_MS = 2200;
const GAME_GONE = "That game is no longer available.";

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

  const enterSeat = useCallback((seat: Seat) => {
    saveSeat(seat);
    setMyId(seat.playerId);
  }, []);

  useEffect(() => {
    const s = makeSocket();
    socketRef.current = s;

    //a tab may take back its own seat, even from a connection that still looks alive
    const resumeOwnSeat = (seat: Seat) => {
      const {roomId, token} = seat;
      s.emit("room:resume", {roomId, token, takeOver: true}, (res: Ack<Seat>) => {
        if (res.ok) {
          enterSeat(res);
          return;
        }
        forgetSeat(seat);
        forgetRoom();
        setLastError(GAME_GONE);
      });
    };

    //a new tab tries each seat this browser holds, and takes the first one nobody is sitting in
    const resumeFreeSeat = ([seat, ...rest]: Seat[], anyGone = false) => {
      if (!seat) {
        if (anyGone) setLastError(GAME_GONE);
        return;
      }
      const {roomId, token} = seat;
      s.emit("room:resume", {roomId, token, takeOver: false}, (res: Ack<Seat>) => {
        if (res.ok) {
          enterSeat(res);
          return;
        }
        const gone = res.error !== "seat in use";
        if (gone) forgetSeat(seat);
        resumeFreeSeat(rest, anyGone || gone);
      });
    };

    s.on("connect", () => {
      setStatus("connected");
      s.emit("meta:getCharacters", {}, (res: Ack<Result<"meta:getCharacters">>) => {
        if (res.ok) setCatalog(res.characters);
        else setLastError(res.error);
      });

      //an invite to a different room wins over any seat elsewhere
      const invited = invitedRoom();
      const own = loadTabSeat();
      if (own && (!invited || invited === own.roomId)) resumeOwnSeat(own);
      else resumeFreeSeat(loadBrowserSeats().filter(seat => !invited || seat.roomId === invited));
    });

    s.on("disconnect", (reason) => {
      setStatus("disconnected");
      //the server dropped us on purpose, which only happens when this seat opened elsewhere
      if (reason === "io server disconnect") {
        releaseTabSeat();
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
  }, [forgetRoom, enterSeat]);

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

  const createRoom = useCallback((name: string) => {
    call("room:create", {name}, enterSeat);
  }, [call, enterSeat]);

  const joinRoom = useCallback((roomId: string, name: string) => {
    call("room:join", {roomId, name}, enterSeat);
  }, [call, enterSeat]);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("room:leave", {});
    const seat = loadTabSeat();
    if (seat) forgetSeat(seat);
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
