import { useEffect, useRef, useState } from 'react';
import {makeSocket} from "./socket";

const CHARACTERS = [
  { id: "bandit",   name: "Bandit" },
  { id: "sorcerer", name: "Sorcerer" },
  { id: "warlord",  name: "Warlord" },
  { id: "inventor", name: "Inventor" },
];


type Player = {id: string; name: string; ready: boolean; characterId: string | null; counts: {deck: number; hand: number; discard: number}; discardTop: Card | null; board: Board};
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type RoomState = {roomId: string; ownerId: string; players: Player[]; game: GameMeta};
type WelcomeMsg = {id: string; ts: number};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string};
type Card = {id: string; label: string; faceUp: boolean};
type Location = {id: string; name: string; locked?: boolean; top: Card[]; bottom: Card[]};
type Board = {moverAt: 0 | 1 | 2 | 3, locations: Location[]};


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
  const [copied, setCopied] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDiscard, setShowDiscard] = useState(false);
  const [discardCards, setDiscardCards] = useState<Card[]>([]);



  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null);

  const openDiscard = (playerId: string) => {
    const s = sockRef.current!;
    s.emit("pile:getDiscard", { playerId }, (res: { ok: boolean; error?: string; cards?: Card[] }) => {
      if (!res?.ok) return setLastError(res?.error || "Failed to open discard");
      setDiscardCards(res.cards || []);
      setShowDiscard(true);
    });
  };

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
    s.on("room:state", (st: any) => {
      const phase = st?.game?.phase ?? "(unknown)";
      const players = Array.isArray(st?.players) ? st.players : [];

      console.log("[room:state]", {
        phase,
        players: players.map((p: any) => ({
          name: p?.name ?? "(?)",
          discard: p?.counts?.discard ?? 0,
          top: p?.discardTop?.label ?? "-",
        })),
      });
      setRoom(st as RoomState);
      setLastError(null);
    });
    s.on("chat:history", (payload: {roomId: string; messages: ChatMsg[]}) => {
      setMessages(payload.messages);
    });
    s.on("chat:msg", (payload: {roomId: string; msg: ChatMsg}) => {
      setMessages((prev) => [...prev, payload.msg]);
    });
    s.on("room:self", (payload: { roomId: string; hand: Card[]; counts: { deck: number; hand: number; discard: number } }) => {
      console.log("[room:self]", { handCount: payload.hand.length });
      setMyHand(payload.hand);
      //clear if card left hand
      setSelectedIds((prev) => {
        const have = new Set(payload.hand.map((c) => c.id));
        const filtered = Array.from(prev).filter((id) => have.has(id));
        return new Set(filtered);
      });
    });

    return () => {
      s.close();
    };
  }, []);

  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = (p.get("room") || "").trim();
    if (r) setRoomIdInput(r);
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = (p.get("room") || "").trim();
    if (r) {
      setRoomIdInput(r);
      setInviteMode(true);
    }
  }, []);

  useEffect(() => {
    if (!room) return;
    if (!focusPlayerId) {
      setFocusPlayerId(myId ?? room.players[0]?.id ?? null);
    }
  }, [room, myId, focusPlayerId]);

  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(() => setLastError(null), 2200);
    return () => clearTimeout(t);
  }, [lastError]);


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

  const leaveRoom = () => {
    const s = sockRef.current!;
    s.emit("room:leave", (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setLastError(res.error || "Leave failed");
      //local reset (server will stop sending room:state)
      setRoom(null);
      setMessages([]);
      setInviteMode(false);
      history.replaceState(null, "", window.location.pathname);
    });
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

  const copyInviteLink = async () => {
    if (!room) return;
    // Build a clean invite URL with ?room=<id>
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("room", room.roomId);
    const invite = url.toString();

    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = invite;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
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

  const drawOne = () => {
    const s = sockRef.current!;
    s.emit("game:draw", { count: 1 }, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) setLastError(res.error || "Draw failed");
    });
  };

  const discardSelected = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const s = sockRef.current!;
    s.emit("game:discard", { cardIds: ids }, (res: { ok: boolean; error?: string; discarded?: number }) => {
      if (!res?.ok) return setLastError(res?.error || "Discard failed");
      clearSelection();
    });
  };

 const onDraftKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter"){
      e.preventDefault();
      sendChat();
    }
  };

  const playTo = (k: number) => {
    if (selectedIds.size !== 1) {
      setLastError("Select exactly one card to play.");
      return;
    }
    const [onlyId] = Array.from(selectedIds);
    const s = sockRef.current!;
    s.emit("game:playToLocation", { cardId: onlyId, locationIndex: k }, (res: { ok: boolean; error?: string }) => {
      if (!res.ok) return setLastError(res.error || "Play failed");
      clearSelection();
    });
  };

  const isMyTurn = !!(room && myId && room.game.activePlayerId === myId);
  const inRoom = !!room;
  const iAmOwner = !!(room && myId && room.ownerId === myId);
  const phase = room?.game.phase ?? "lobby";
  const me = room?.players.find(p => p.id === myId) || null;
  const everyoneReady = !!room && room.players.length >= 2 && room.players.every(p => p.ready);
  const focusPlayer = room?.players.find(p => p.id === focusPlayerId) || null;
  const viewingSelf = !!(focusPlayer && myId && focusPlayer.id === myId);
 

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16}}>
      <h1>Villainous</h1>
      <p>Socket: <strong>{status}</strong></p>
      {welcome && (
        <p style={{ opacity: 0.8 }}>
          hello from server — id: <code>{welcome.id}</code>, time: {new Date(welcome.ts).toLocaleTimeString()}
        </p>
      )}

      <hr />

      {/*create/join when not in room*/}
      {!inRoom && !inviteMode && (
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jeff"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          {/*create*/}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            <h3 style={{ margin: 0 }}>Create a room</h3>
            <p style={{ marginTop: 6, opacity: 0.75 }}>We’ll generate a room ID for you.</p>
            <button onClick={createRoom} disabled={!name.trim()}>
              Create Room
            </button>
          </div>

          <div style={{ textAlign: "center", opacity: 0.6 }}>— or —</div>

          {/*join*/}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            <h3 style={{ margin: 0 }}>Join a room</h3>
            <p style={{ marginTop: 6, opacity: 0.75 }}>Paste the room ID from the host.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                placeholder="Enter room ID (e.g., abc123)"
                style={{ flex: 1, padding: 8 }}
              />
              <button onClick={joinRoom} disabled={!name.trim() || !roomIdInput.trim()}>
                Join Room
              </button>
            </div>
          </div>

          {lastError && <div style={{ color: "crimson" }}>{lastError}</div>}
        </div>
      )}

      {/*join only when invited*/}
      {!inRoom && inviteMode && (
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jeff"
              style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            <h3 style={{ margin: 0 }}>Join this room</h3>
            <p style={{ marginTop: 6, opacity: 0.75 }}>
              You’ve been invited to <code>{roomIdInput}</code>.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                style={{ flex: 1, padding: 8 }}
              />
              <button onClick={joinRoom} disabled={!name.trim() || !roomIdInput.trim()}>
                Join Room
              </button>
            </div>
          </div>

          {lastError && <div style={{ color: "crimson" }}>{lastError}</div>}
        </div>
      )}

        {room ? (
          phase === "lobby" ? (
            //lobby screen
            <div>
              <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>Room:</strong> <code>{room.roomId}</code>
                <button onClick={copyInviteLink} title="Copy invite link">
                  {copied ? "Copied!" : "Copy Link"}
                </button>
                <span style={{ marginLeft: "auto" }} />
                <button onClick={leaveRoom}>Leave Room</button>
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
          <div style={{ display: "grid", gap: 12 }}>

          {/* Header: room + copy link + leave */}
          <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>Room:</strong> <code>{room.roomId}</code>
            <button onClick={copyInviteLink} title="Copy invite link">
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <span style={{ marginLeft: "auto" }} />
            <button onClick={leaveRoom}>Leave Room</button>
          </p>

          {/* Turn bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <strong>Turn:</strong> {room.game.turn}{" "}
              <span style={{ opacity: 0.8 }}>
                — Active: {room.players.find(p => p.id === room.game.activePlayerId)?.name ?? "—"}
              </span>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button onClick={endTurn} disabled={!inRoom || !isMyTurn}>
                End Turn
              </button>
              {!isMyTurn && inRoom && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>(not your turn)</span>
              )}
            </div>
          </div>

          {lastError && (
            <div style={{
              position: "fixed", top: 16, right: 16, zIndex: 50,
              background: "#b91c1c", color: "white",
              padding: "8px 12px", borderRadius: 8,
              boxShadow: "0 6px 18px rgba(0,0,0,.35)"
            }}>
              {lastError}
            </div>
          )}

          {/* Camera controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong>View:</strong>
            {room.players.map(p => (
              <button
                key={p.id}
                onClick={() => setFocusPlayerId(p.id)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: p.id === focusPlayerId ? "2px solid #3b82f6" : "1px solid #334155",
                  background: p.id === focusPlayerId ? "#1e293b" : "#111827",
                  color: "#e5e7eb"
                }}
              >
                {p.id === myId ? `${p.name} (you)` : p.name}
              </button>
            ))}
          </div>
            
            {/* DEBUG: safe discard probe (remove later) */}
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {focusPlayer
                ? (
                  <>
                    <span>focus: <b>{focusPlayer.name}</b></span>
                    <span style={{ marginLeft: 12 }}>
                      discard: {focusPlayer.counts?.discard ?? 0}
                    </span>
                    <span style={{ marginLeft: 12 }}>
                      top: {focusPlayer.discardTop?.label ?? "—"}
                    </span>
                  </>
                )
                : <span>focus: (none yet)</span>
              }
            </div>


          {/* BOARD panel (dark) */}
          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 12,
              background: "#1f2937",
              color: "#e5e7eb",
            }}
          >

            {focusPlayer && (
              <>
              <DiscardPeek
                player={focusPlayer}
                myId={myId}
                onOpen={() => openDiscard(focusPlayer.id)}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                {focusPlayer.board.locations.map((loc, i) => {
                  const viewingSelf = focusPlayerId === myId;
                  const canDropHere = viewingSelf && isMyTurn;
                  return (
                    <div
                      key={loc.id}
                      style={{
                        border: "1px solid #475569",
                        borderRadius: 10,
                        padding: 10,
                        background: "#0f172a",
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        {loc.name} (L{i + 1}) {loc.locked ? "🔒" : ""}
                      </div>

                      {/* Top (public) */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Top</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {loc.top.length === 0 ? (
                            <span style={{ opacity: 0.6, fontSize: 12 }}>empty</span>
                          ) : (
                            loc.top.map(c => (
                              <div
                                key={c.id}
                                title={c.label}
                                style={{
                                  minWidth: 54, height: 78,
                                  border: "1px solid #64748b",
                                  borderRadius: 6,
                                  background: "#111827",
                                  color: "#e5e7eb",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 11, padding: 4, textAlign: "center",
                                }}
                              >
                                {c.label}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Bottom (your plays) */}
                      <div
                        onClick={() => {
                          if (!canDropHere) return;
                          if (selectedIds.size !== 1) return setLastError("Select exactly one card to play.");
                          playTo(i);
                        }}
                        style={{
                          border: "1px dashed " + (canDropHere ? "#3b82f6" : "#475569"),
                          borderRadius: 8,
                          padding: 6,
                          background: "#111827",
                          cursor: canDropHere && selectedIds ? "pointer" : "default",
                          minHeight: 88,
                        }}
                        title={
                          canDropHere
                            ? (selectedIds.size !== 1 ? "Click to play selected card here" : "Select exactly one card")
                            : "You can only play on your own board during your turn"
                        }
                      >
                        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Bottom</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {loc.bottom.length === 0 ? (
                            <span style={{ opacity: 0.6, fontSize: 12 }}>empty</span>
                          ) : (
                            loc.bottom.map(c => (
                              <div
                                key={c.id}
                                title={c.label}
                                style={{
                                  minWidth: 54, height: 78,
                                  border: "1px solid #64748b",
                                  borderRadius: 6,
                                  background: "#0b1220",
                                  color: "#e5e7eb",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 11, padding: 4, textAlign: "center",
                                }}
                              >
                                {c.label}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>

          {/* HAND panel (dark) */}
          <div
            style={{
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 12,
              background: "#1f2937",
              color: "#e5e7eb",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong>Your hand</strong>
              <button onClick={drawOne} disabled={!isMyTurn}>Draw 1</button>
              <button
                onClick={discardSelected}
                disabled={!isMyTurn || selectedIds.size === 0}
                title={selectedIds.size === 0 ? "Select a card in your hand" : "Discard the selected card"}>
                Discard
              </button>
              {!isMyTurn && <span style={{ opacity: 0.7 }}>(not your turn)</span>}
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                padding: 8,
                border: "1px solid #475569",
                borderRadius: 8,
                overflowX: "auto",
                background: "#0f172a",
              }}
            >
              {myHand.length === 0 && <div style={{ opacity: 0.7 }}>Empty</div>}
              {myHand.map((c) => {
                const selected = selectedIds.has(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    title={c.label}
                    style={{
                      minWidth: 88, height: 128, padding: 8,
                      border: selected ? "2px solid #3b82f6" : "1px solid #64748b",
                      borderRadius: 8,
                      background: "#111827", color: "#f1f5f9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", userSelect: "none",
                      textAlign: "center", fontSize: 12,
                    }}
                  >
                    {c.label}
                  </div>
                );
              })}
            </div>

            {/* (optional) keep button fallback for now */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[0,1,2,3].map(k => (
                <button
                  key={k}
                  onClick={() => playTo(k)}
                  disabled={selectedIds.size === 0 || !isMyTurn}
                  title={selectedIds.size === 0 ? "Select exactly one card" : (!isMyTurn ? "Not your turn" : `Play to L${k+1}`)}
                >
                  Play to L{k+1}
                </button>
              ))}
            </div>
          </div>
          
          <DiscardModal
            open={showDiscard}
            cards={discardCards}
            onClose={() => setShowDiscard(false)}
          />


          {/*chat*/}
          <div style={{ marginTop: 8 }}>
            <LobbyChat
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              onKey={onDraftKey}
              send={sendChat}
              myId={myId}
            />
          </div>
          

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
                {m.name}:
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
function DiscardPeek({
  player,
  myId,
  onOpen,
}: {
  player: Player | null;
  myId: string | null;
  onOpen: () => void;
}) {
  const count = player?.counts?.discard ?? 0;
  const topLabel = player?.discardTop?.label ?? "—";
  const ownerLabel = player
    ? (myId && player.id === myId ? "Your" : `${player.name}'s`)
    : "Discard";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 8,
        background: "#111827",
        color: "#e5e7eb",
        marginBottom: 8,
      }}
    >
      <strong>{ownerLabel} discard</strong>
      <span style={{ opacity: 0.8 }}>({count})</span>

      <span style={{ marginLeft: 8, opacity: 0.8 }}>Top:</span>
      <span
        style={{
          border: "1px solid #475569",
          borderRadius: 6,
          padding: "4px 6px",
          background: "#1f2937",
        }}
      >
        {topLabel}
      </span>

      <span style={{ marginLeft: "auto" }} />
      <button onClick={onOpen} disabled={count === 0}>
        Open Discard
      </button>
    </div>
  );
}


function DiscardModal({
  open,
  cards,
  onClose,
}: {
  open: boolean;
  cards: Card[];
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 90vw)",
          maxHeight: "75vh",
          overflowY: "auto",
          background: "#111827",
          color: "#e5e7eb",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Discard pile ({cards.length})</strong>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={onClose}>Close</button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          {cards.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Empty</div>
          ) : (
            cards.map((c, idx) => (
              <div
                key={c.id}
                title={c.label}
                style={{
                  position: "relative",
                  minWidth: 90,
                  height: 130,
                  padding: 8,
                  border: "1px solid #475569",
                  borderRadius: 8,
                  background: "#1f2937",
                  color: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 8,
                    fontSize: 11,
                    opacity: 0.6,
                  }}
                >
                  #{cards.length - idx}
                </div>
                {c.label}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
