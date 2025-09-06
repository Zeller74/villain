import { useEffect, useRef, useState } from 'react';
import {makeSocket} from "./socket";

const CHARACTERS = [
  { id: "bandit",   name: "Bandit" },
  { id: "sorcerer", name: "Sorcerer" },
  { id: "warlord",  name: "Warlord" },
  { id: "inventor", name: "Inventor" },
];


type Player = {id: string; name: string; ready: boolean; characterId: string | null};
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type RoomState = {roomId: string; ownerId: string; players: Player[]; game: GameMeta};
type WelcomeMsg = {id: string; ts: number};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string};

export default function App() {
  const sockRef = useRef<ReturnType<typeof makeSocket> | null>(null);

  //states
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [welcome, setWelcome] = useState<WelcomeMsg | null>(null);
  const [name, setName] = useState("");
  const [roomIdInput, setRoomIdInput] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  

  useEffect(() => {
    const s = makeSocket();
    sockRef.current = s;

    s.on("connect", () => {
      setStatus("connected");
      setMyId(s.id ?? null);
    });
    s.on("disconnect", () =>{
       setStatus("disconnected");
       setMessages([]);
       setMyId(null);
    });
    s.on("server:welcome", (msg: WelcomeMsg) => setWelcome(msg));
    s.on("room:state", (st: RoomState) =>{
      setRoom(st);
      setLastError(null);
    })
    s.on("chat:history", (payload: {roomId: string; messages: ChatMsg[]}) => {
      setMessages(payload.messages);
    });
    s.on("chat:msg", (payload: {roomId: string; msg: ChatMsg}) => {
      setMessages((prev) => [...prev, payload.msg]);
    });
    

    return () => {
      s.close();
    };
  }, []);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);


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

  const chooseCharacter = (characterId: string) => {
    const s = sockRef.current!;
    s.emit("lobby:chooseCharacter", { characterId }, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setLastError(res.error || "Choose failed");
    });
  };

  const setReady = (ready: boolean) => {
    const s = sockRef.current!;
    s.emit("lobby:setReady", { ready }, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setLastError(res.error || "Ready failed");
    });
  };

  const startGame = () => {
    const s = sockRef.current!;
    s.emit("lobby:start", (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setLastError(res.error || "Start failed");
    });
  };


  const sendChat = () => {
    setLastError(null);
    const s = sockRef.current!;
    const text = draft.trim();
    if (!text) return;

    s.emit("chat:send", {text}, (res: {ok: boolean; error?: string}) => {
      if (!res.ok) return setLastError(res.error || "Send failed");
      setDraft("");
    });
  };

  const isMyTurn = !!(room && myId && room.game.activePlayerId === myId);
  const inRoom = !!room;
  const iAmOwner = !!(room && myId && room.ownerId === myId);
  const phase = room?.game.phase ?? "lobby";
  const me = room?.players.find(p => p.id === myId) || null;
  const everyoneReady = !!room && room.players.length >= 2 && room.players.every(p => p.ready);


  const onDraftKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter"){
      e.preventDefault();
      sendChat();
    }
  };

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
          phase === "lobby" ? (
            //lobby screen
            <div>
              <p>
                <strong>Room:</strong> <code>{room.roomId}</code>{" "}
                <button onClick={copyRoomId} title="Copy to clipboard">Copy</button>
              </p>

              <p style={{ marginTop: 8 }}>
                <strong>Owner:</strong> {room.players.find(p => p.id === room.ownerId)?.name ?? room.ownerId.slice(0,6)}
              </p>

              {/*player list with ready and characters*/}
              <ul style={{ marginTop: 8 }}>
                {room.players.map((p) => (
                  <li key={p.id} style={{ marginBottom: 4 }}>
                    {p.name} {p.id === room.ownerId ? "(owner)" : ""} —{" "}
                    <span>{p.ready ? "✅ ready" : "⌛ not ready"}</span>{" "}
                    <span style={{ opacity: 0.7, marginLeft: 8 }}>
                      {p.characterId ? `as ${p.characterId}` : "(no character)"}
                    </span>
                    {myId === p.id ? " — you" : ""}
                  </li>
                ))}
              </ul>

              {/*character select and ready*/}
              {me && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <label>
                    Character{" "}
                    <select
                      value={me.characterId ?? ""}
                      onChange={(e) => chooseCharacter(e.target.value)}
                      style={{ padding: 6 }}
                    >
                      <option value="" disabled>Choose…</option>
                      {CHARACTERS.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={!!me.ready}
                      onChange={(e) => setReady(e.target.checked)}
                    />
                    Ready
                  </label>
                </div>
              )}

              {/*owner start button*/}
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={startGame}
                  disabled={!iAmOwner || !everyoneReady}
                  title={!iAmOwner ? "Owner only" : (!everyoneReady ? "Need at least 2 players, all ready" : "Start")}
                >
                  Start Game
                </button>
                {!iAmOwner && <span style={{ marginLeft: 8, opacity: 0.7 }}>(owner only)</span>}
                {iAmOwner && !everyoneReady && <span style={{ marginLeft: 8, opacity: 0.7 }}>(need ≥2 players, all ready)</span>}
              </div>

              <hr />

              <LobbyChat
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                onKey={onDraftKey}
                send={sendChat}
                myId={myId}
              />
            </div>
          ) : (
            //game screen
            <div>
              <p>
                <strong>Room:</strong> <code>{room.roomId}</code>{" "}
                <button onClick={copyRoomId} title="Copy to clipboard">Copy</button>
              </p>

              <p>
                <strong>Turn:</strong> {room.game.turn}{" "}
                <span style={{ opacity: 0.7 }}>
                  — Active: {room.players.find(p => p.id === room.game.activePlayerId)?.name ?? "—"}
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

              <hr />

              {/*same lobby*/}
              <LobbyChat
                messages={messages}
                draft={draft}
                setDraft={setDraft}
                onKey={onDraftKey}
                send={sendChat}
                myId={myId}
              />
            </div>
          )
        ) : (
          <p>Not in a room yet.</p>
        )}

    </div>
  );
}

function LobbyChat({
  messages,
  draft,
  setDraft,
  onKey,
  send,
  myId,
}: {
  messages: ChatMsg[];
  draft: string;
  setDraft: (s: string) => void;
  onKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  send: () => void;
  myId: string | null;
}) {
  const boxStyle: React.CSSProperties = {
    border: "1px solid #334155",
    borderRadius: 8,
    padding: 8,
    height: 200,
    overflowY: "auto",
    background: "#242424",  // your chosen dark
    color: "#e5e7eb",
    marginBottom: 8,
  };

  return (
    <div>
      <p><strong>Room chat</strong></p>
      <div style={boxStyle}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.6 }}>No messages yet.</div>
        )}
        {messages.map((m) => {
          const mine = m.playerId === myId;
          const time = new Date(m.ts).toLocaleTimeString();
          return (
            <div key={m.id} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: mine ? 700 : 600 }}>
                {m.name}{mine ? " (you)" : ""}:
              </span>{" "}
              <span>{m.text}</span>
              <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 12 }}>
                {time}
              </span>
            </div>
          );
        })}
      </div>

      <div className="chat" style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a message"
          style={{
            flex: 1,
            padding: 8,
            background: "#1f2937",
            color: "#f1f5f9",
            border: "1px solid #334155",
            borderRadius: 6,
            outline: "none",
            caretColor: "#f1f5f9",
          }}
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          style={{
            padding: "8px 12px",
            background: "#334155",
            color: "#e5e7eb",
            border: "1px solid #475569",
            borderRadius: 6,
            cursor: !draft.trim() ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
