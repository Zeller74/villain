import { useEffect, useRef, useState } from 'react';
import {makeSocket} from "./socket";

type Player = {id: string; name: string};
type GameMeta = {turn: number; activePlayerId: string | null};
type RoomState = {roomId: string; players: Player[]; game: GameMeta};
type WelcomeMsg = {id: string; ts: number};

export default function App() {
  const sockRef = useRef<ReturnType<typeof makeSocket> | null>(null);

  //connection status and welcome paylod
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [welcome, setWelcome] = useState<WelcomeMsg | null>(null);
  //inputs
  const [name, setName] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  //roomstate
  const [room, setRoom] = useState<RoomState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  //user ids
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const s = makeSocket();
    sockRef.current = s;

    s.on("connect", () => {
      setStatus("connected");
      setMyId(s.id ?? null);
    });
    s.on("disconnect", () =>{
       setStatus("disconnected");
       setMyId(null);
    });
    s.on("server:welcome", (msg: WelcomeMsg) => setWelcome(msg));
    s.on("room:state", (st: RoomState) =>{
      setRoom(st);
      setLastError(null);
    })

    return () => {
      s.close();
    };
  }, []);

  const createRoom = () => {
    setLastError(null);
    const s = sockRef.current!;
    if (!name.trim()) {
      setLastError("Enter a name first.");
      return;
    }
    s.emit(
      "room:create",
      { name: name.trim() },
      (res: { ok: boolean; roomId?: string; error?: string }) => {
        if (!res.ok) return setLastError(res.error || "Create failed");
        setRoomIdInput(res.roomId!);
      }
    );
  };

  const joinRoom = () => {
    setLastError(null);
    const s = sockRef.current!;
    if (!name.trim()){
      setLastError("Enter a name first.");
      return;
    }
    if (!roomIdInput.trim()) {
      setLastError("Enter a room id.");
      return;
    }
    s.emit(
      "room:join",
      {roomId: roomIdInput.trim(), name: name.trim()},
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok) setLastError(res.error || "Join failed");
      }
    );
  };

  const endTurn = () => {
    setLastError(null);
    const s = sockRef.current!;
    s.emit("game:endTurn", (res: {ok: boolean; error?: string}) => {
      if (!res.ok) setLastError(res.error || "End turn failed");
    });
  };

  const copyRoomId = async () => {
    if(room?.roomId && navigator.clipboard){
      await navigator.clipboard.writeText(room.roomId);
    }
  };

  const isMyTurn = !!(room && myId && room.game.activePlayerId === myId);
  const inRoom = !!room;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 640 }}>
      <h1>Villainous</h1>
      <p>Socket: <strong>{status}</strong></p>
      {welcome && (
        <p style={{ opacity: 0.8 }}>
          hello from server — id: <code>{welcome.id}</code>, time: {new Date(welcome.ts).toLocaleTimeString()}
        </p>
      )}

      <hr />

      <div style={{ display: "grid", gap: 8 }}>
        <label>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., jeffrey"
            style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={createRoom}>Create Room</button>
          <input
            value={roomIdInput}
            onChange={(e) => setRoomIdInput(e.target.value)}
            placeholder="Room ID"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>

        {lastError && <div style={{ color: "crimson" }}>{lastError}</div>}
      </div>

      <hr />

      {room ? (
        <div>
          <p>
            <strong>Room:</strong> <code>{room.roomId}</code>{" "}
            <button onClick={copyRoomId} title="Copy to clipboard">Copy</button>
          </p>
          <p>
            <strong>Turn:</strong> {room.game.turn}{" "}
            <span style={{ opacity: 0.7 }}>
              — Active:{" "}
              {room.players.find(p => p.id === room.game.activePlayerId)?.name ?? "—"}
            </span>
          </p>

          <ul>
            {room.players.map((p) => {
              const active = p.id === room.game.activePlayerId;
              return (
                <li key={p.id}>
                  {active ? "🟢" : "⚪️"} {p.name}{" "}
                  <span style={{ opacity: 0.6 }}>({p.id.slice(0, 6)}…)</span>
                  {myId === p.id ? " — you" : ""}
                </li>
              );
            })}
          </ul>

          <div style={{ marginTop: 8 }}>
            <button onClick={endTurn} disabled={!inRoom || !isMyTurn}>
              End Turn
            </button>
            {!isMyTurn && inRoom && (
              <span style={{ marginLeft: 8, opacity: 0.7 }}>(not your turn)</span>
            )}
          </div>
        </div>
      ) : (
        <p>Not in a room yet.</p>
      )}
    </div>
  );
}