import { useEffect, useRef, useState, useMemo } from 'react';
import {makeSocket} from "./socket";


type Player = {id: string; name: string; ready: boolean; characterId: string | null; counts: {deck: number; hand: number; discard: number; fateDeck?: number; fateDiscard?: number}; discardTop: Card | null; board: Board; power?: number;};
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type RoomState = {roomId: string; ownerId: string; players: Player[]; game: GameMeta};
type WelcomeMsg = {id: string; ts: number};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string};
type Card = {id: string; label: string; faceUp: boolean; locked?: boolean; desc?: string; cost: number; baseStrength?: number | null; strength?: number};
type Location = {id: string; name: string; locked?: boolean; top: Card[]; bottom: Card[]; actions?: ActionKind[]; topSlots?: number;};
type Board = {moverAt: 0 | 1 | 2 | 3, locations: Location[]};
type LogItem = {id: string; ts: number; actorId: string; actorName: string; type: "draw" | "play" | "discard" | "undo" | "move" | "remove" | "reshuffle" | "retrieve" | "pawn" | "strength" | "fate_reshuffle"; text: string;}
type ActionKind =
  | "gain1" | "gain2" | "gain3"
  | "play"
  | "draw2"
  | "fate"
  | "discard"
  | "moveItemAlly"
  | "moveHero"
  | "vanquish"
  | "activate";
type CharacterPreview = {
  id: string;
  name: string;
  locations: { name: string; actions: ActionKind[]; topSlots?: number }[];
};

const ACTION_LABELS: Record<ActionKind, string> = {
  gain1: "Gain 1",
  gain2: "Gain 2",
  gain3: "Gain 3",
  play: "Play 1",
  draw2: "Draw 2",
  fate: "Fate",
  discard: "Discard",
  moveItemAlly: "Move Item/Ally",
  moveHero: "Move Hero",
  vanquish: "Vanquish",
  activate: "Activate",
};





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
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [moving, setMoving] = useState<{ cardId: string; from: number; label: string; row: "bottom" | "top" } | null>(null);
  const [focusPlayerId, setFocusPlayerId] = useState<string | null>(null);
  const [fateTargetId, setFateTargetId] = useState<string | null>(null);
  const [fateChoices, setFateChoices] = useState<Card[]>([]);
  const [fatePlacing, setFatePlacing] = useState<{targetId: string; cardId: string; label: string} | null>(null); 
  const [showFateDiscard, setShowFateDiscard] = useState(false);
  const [fateDiscardCards, setFateDiscardCards] = useState<Card[]>([]);
  const [fateDiscardTarget, setFateDiscardTarget] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CharacterPreview[]>([]);
  const [pendingCharId, setPendingCharId] = useState<string>("");


  useEffect(() => {
    const s = makeSocket();
    sockRef.current = s;

    s.on("connect", () => {
      setStatus("connected");
      setMyId(s.id ?? null);
          // ask server for available characters
      s.emit("meta:getCharacters", {}, (res: { ok: boolean; characters?: CharacterPreview[]; error?: string } | undefined) => {
        if (res?.ok && res.characters) {
          setCatalog(res.characters);
          // default select first if nothing chosen
          if (!pendingCharId && res.characters.length > 0) {
            setPendingCharId(res.characters[0].id);
          }
        } else {
          setLastError(res?.error || "Failed to load character list");
        }
      });
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
    s.on("room:log", (payload: {items?: LogItem[]}) => {
      setLogItems(Array.isArray(payload?.items) ? payload.items : []);
    })

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
  
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const openDiscard = (playerId: string) => {
    const s = sockRef.current!;
    s.emit("pile:getDiscard", { playerId }, (res: { ok: boolean; error?: string; cards?: Card[] }) => {
      if (!res?.ok) return setLastError(res?.error || "Failed to open discard");
      setDiscardCards(res.cards || []);
      setShowDiscard(true);
    });
  };

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

  const undoSelf = () => {
    const s = sockRef.current!;
    s.emit("log:undoSelf", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setLastError(res?.error || "Undo failed");
    });
  };

  const startMove = (cardId: string, from: number, label: string) => {
    if (!isMyTurn) { setLastError("Not your turn"); return; }
    setMoving({ cardId, from, label, row: "bottom"});
  };

  const cancelMove = () => setMoving(null);

  const dropMoveTo = (to: number) => {
    if (!moving || moving.row !== "bottom") return;
    const s = sockRef.current!;
    s.emit("game:moveCard", { cardId: moving.cardId, from: moving.from, to }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Move failed");
      setMoving(null);
    });
  };

  const removeFromBoard = () => {
    if (!moving) return;
    const s = sockRef.current!;
    s.emit("game:removeCard", { cardId: moving.cardId, from: moving.from }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Remove failed");
      setMoving(null);
    });
  };

  const reshuffleDiscard = () => {
    const s = sockRef.current!;
    s.emit("game:reshuffleDeck", (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setLastError(res?.error || "Reshuffle failed");
    });
  };

  const takeFromDiscard = (cardId: string) => {
    const s = sockRef.current!;
    s.emit("pile:takeFromDiscard", { cardId }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Take from discard failed");
      // Optimistic update so the modal reflects instantly:
      setDiscardCards(prev => prev.filter(c => c.id !== cardId));
    });
  };

  const changePower = (delta: number) => {
    const s = sockRef.current!;
    s.emit("power:change", { delta }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setLastError(res?.error || "Power change failed");
    });
  };

  const changeCardStrength = (cardId: string, delta: number) => {
    const s = sockRef.current!;
    s.emit("card:deltaStrength", { cardId, delta }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setLastError(res?.error || "Strength change failed");
    });
  };

  const startFateFor = (targetId: string) => {
    const s = sockRef.current!;
    setLastError(null);
    // Switch camera to the target (nice UX)
    setFocusPlayerId(targetId);
    s.emit("fate:start", { targetId }, (res: { ok: boolean; error?: string; cards?: Card[] }) => {
      if (!res?.ok) return setLastError(res?.error || "Fate start failed");
      setFateTargetId(targetId);
      setFateChoices(res.cards || []);
      setFatePlacing(null);
    });
  };

  const reshuffleFateDiscardFor = (playerId: string) => {
    const s = sockRef.current!;
    s.emit("fate:reshuffleDeck", { playerId }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) setLastError(res?.error || "Fate reshuffle failed");
    });
  };

  const openFateDiscardFor = (playerId: string) => {
    const s = sockRef.current!;
    setLastError(null);
    s.emit("fate:getDiscard", { playerId }, (res: { ok: boolean; error?: string; cards?: Card[] }) => {
      if (!res?.ok) return setLastError(res?.error || "Failed to fetch fate discard");
      setFateDiscardTarget(playerId);
      setFateDiscardCards(res.cards || []);
      setShowFateDiscard(true);
    });
  };

  const chooseFateCard = (card: Card) => {
    const s = sockRef.current!;
    s.emit("fate:choosePlay", { cardId: card.id }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Choose fate card failed");
      setFatePlacing({ targetId: fateTargetId!, cardId: card.id, label: card.label });
      // Collapse the panel visually (we’ll hide it when placing is active)
    });
  };

  const cancelFate = () => {
    const s = sockRef.current!;
    s.emit("fate:cancel", {}, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Cancel fate failed");
      setFateTargetId(null);
      setFateChoices([]);
      setFatePlacing(null);
    });
  };

  const placeFateAt = (locIndex: number) => {
    const s = sockRef.current!;
    s.emit("fate:placeSelected", { locationIndex: locIndex }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Place fate failed");
      setFateTargetId(null);
      setFateChoices([]);
      setFatePlacing(null);
    });
  };

  const startFateFromDiscard = (targetId: string, cardId: string) => {
    const s = sockRef.current!;
    setLastError(null);
    // Switch camera to the target (nice UX)
    setFocusPlayerId(targetId);
    s.emit("fate:startFromDiscard", { targetId, cardId }, (res: { ok: boolean; error?: string; card?: Card }) => {
      if (!res?.ok) return setLastError(res?.error || "Start fate from discard failed");
      setShowFateDiscard(false);
      setFateTargetId(targetId);
      const card = res.card!;
      setFateChoices([card]); // for consistency, though we go straight to placing
      setFatePlacing({ targetId, cardId: card.id, label: card.label });
    });
  };

  const startMoveTop = (cardId: string, from: number, label: string) => {
    if (!isMyTurn || focusPlayerId !== myId) { setLastError("Not your turn"); return; }
    setMoving({ cardId, from, label, row: "top" });
  };

  const dropMoveTop = (toLoc: number) => {
    if (!moving || moving.row !== "top") return;
    console.log("dropMoveTop →", { from: moving.from, to: toLoc, cardId: moving.cardId });
    const s = sockRef.current!;
    s.emit("board:moveTop", { cardId: moving.cardId, from: moving.from, to: toLoc },
      (res: { ok: boolean; error?: string }) => {
        if (!res?.ok) return setLastError(res?.error || "Move top failed");
        setMoving(null);
      });
  };

  const discardTopFromMoving = () => {
    if (!moving || moving.row !== "top") return;
    const s = sockRef.current!;
    s.emit(
      "board:discardTop",
      { locationIndex: moving.from, cardId: moving.cardId },
      (res: { ok: boolean; error?: string } | undefined) => {
        if (!res?.ok) return setLastError(res?.error || "Discard top failed");
        setMoving(null);
      }
    );
  };

  const claimWin = () => {
    const s = sockRef.current!;
    setLastError(null);
    s.emit("game:claimWin", {}, (res: { ok: boolean; error?: string } | undefined) => {
      if (!res?.ok) setLastError(res?.error || "Win failed");
    });
  };

  const catById = useMemo(
    () => Object.fromEntries(catalog.map(c => [c.id, c] as const)),
    [catalog]
  );


  const isMyTurn = !!(room && myId && room.game.activePlayerId === myId);
  const inRoom = !!room;
  const iAmOwner = !!(room && myId && room.ownerId === myId);
  const phase = room?.game.phase ?? "lobby";
  const me = room?.players.find(p => p.id === myId) || null;
  const everyoneReady = !!room && room.players.length >= 2 && room.players.every(p => p.ready);
  const focusPlayer = room?.players.find(p => p.id === focusPlayerId) || null;
  const lastLog = logItems[0] ?? null;
  const canUndo = !!(lastLog && myId && lastLog.actorId === myId && lastLog.type !== "undo" && room?.game.phase === "playing");
  const canTakeFromThisDiscard = !!(focusPlayer && myId && focusPlayer.id === myId && isMyTurn);
  const viewingSelf = !!(myId && focusPlayerId === myId);
  


 

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
                      {p.characterId
                        ? `as ${catById[p.characterId]?.name ?? p.characterId}`
                        : "(no character)"}
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
                      {catalog.map(c => (
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
              {viewingSelf && (
                <button
                  onClick={claimWin}
                  title="Announce that you've achieved your objective"
                  style={{ marginLeft: 6 }}
                >
                  I Win
                </button>
              )}
              <button onClick={endTurn} disabled={!inRoom || !isMyTurn}>
                End Turn
              </button>
              {!isMyTurn && inRoom && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>(not your turn)</span>
              )}
              <button onClick={undoSelf} disabled={!canUndo} style={{ marginLeft: 8 }}>
                Undo
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

          {/*Move mode banner*/}
          {moving && (
            <div style={{
              border: "1px solid #334155", borderRadius: 8, padding: "6px 10px",
              background: "#111827", color: "#e5e7eb", display: "flex", alignItems: "center", gap: 8
            }}>
              Moving <strong>{moving.label}</strong>
              <span style={{ opacity: 0.7 }}>&middot; click a location to drop</span>
              {moving.row === "bottom" && (
                <button onClick={removeFromBoard} style={{ marginLeft: "auto" }}>Discard card</button>
              )}
              {moving.row === "top" && (
                <button onClick={discardTopFromMoving} title="Send this Top card to Fate discard">
                  Discard card
                </button>
              )}
              <button onClick={cancelMove} style={{ marginLeft: "auto" }}>Cancel</button>
            </div>
          )}
          <InfoBar
            focusPlayer={focusPlayer ?? null}
            myId={myId}
            isMyTurn={isMyTurn}
            phase={room?.game.phase ?? "lobby"}
            onChangePower={changePower}
          />
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
                  const isPawnHere = focusPlayer.board.moverAt === i;
                  const canSetPawn = viewingSelf && isMyTurn;
                  const canToggleLocLock = viewingSelf && isMyTurn;
                  const canBottomAct = (moving?.row === "bottom") || (canDropHere && selectedIds.size === 1);

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
                      <div
                        style={{
                          fontWeight: 700,
                          marginBottom: 6,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: canSetPawn ? "pointer" : "default",
                          color: isPawnHere ? "#facc15" : undefined, // highlight pawn row
                        }}
                        title={
                          isPawnHere ? "Pawn is here"
                          : canSetPawn ? "Click to move pawn here"
                          : undefined
                        }
                        onClick={() => {
                          if (!canSetPawn) return;
                          sockRef.current!.emit("pawn:set", { to: i }, (res: { ok: boolean; error?: string }) => {
                            if (!res?.ok) setLastError(res?.error || "Move pawn failed");
                          });
                        }}
                      >
                        {/* tiny pawn dot when active */}
                        {isPawnHere && <span style={{ fontSize: 12 }}>●</span>}
                        <span>{loc.name}{loc.locked ? "🔒" : ""}</span>
                        {canToggleLocLock && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              sockRef.current!.emit("board:toggleLocationLock", { index: i, locked: !loc.locked }, (res: { ok: boolean; error?: string }) => {
                                if (!res?.ok) setLastError(res?.error || "Toggle lock failed");
                              });
                            }}
                            title={loc.locked ? "Unlock this location" : "Lock this location"}
                            style={{
                              marginLeft: "auto",
                              fontSize: 12, padding: "2px 6px",
                              borderRadius: 6, border: "1px solid #334155",
                              background: loc.locked ? "#7f1d1d" : "#1e293b",
                              color: "#e5e7eb",
                              cursor: "pointer",
                            }}
                          >
                            {loc.locked ? "Unlock" : "Lock"}
                          </button>
                        )}
                      </div>

                      {/* Top (public) */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Top</div>

                        <div
                          onClick={() => {
                            if (fatePlacing) {
                              if (!focusPlayer || focusPlayer.id !== fatePlacing.targetId) return;
                              if (loc.locked) { setLastError("Location is locked"); return; }
                              placeFateAt(i);
                              return;
                            }
                            if (moving?.row === "top") {
                              if (!isMyTurn || focusPlayerId !== myId) return;
                              if (loc.locked) { setLastError("Location is locked"); return; }
                              dropMoveTop(i);
                              return;
                            }
                          }}
                          title={
                            fatePlacing
                              ? (loc.locked ? "Location is locked" : "Click to place fate card here (Top)")
                              : undefined
                          }
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            border: (fatePlacing || moving?.row === "top") ? "1px dashed #3b82f6" : "1px solid #475569",
                            borderRadius: 8,
                            padding: 6,
                            cursor: (fatePlacing || moving?.row === "top") ? "pointer" : "default",
                            background: "#111827",
                            minHeight: 130,
                          }}
                        >
                          {loc.top.length === 0 ? (
                            <span style={{ opacity: 0.6, fontSize: 12 }}>empty</span>
                          ) : (
                            loc.top.map((c) => {
                              const canEditTop =
                                focusPlayerId === myId && room?.game.phase === "playing";

                              return (
                                <div key={c.id} style={{ position: "relative", display: "inline-block" }}>
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!isMyTurn || focusPlayerId !== myId) return;
                                      if (moving?.row === "top") {
                                        if (loc.locked) { setLastError("Location is locked"); return; }
                                        dropMoveTop(i);
                                        return;
                                      }
                                      if (c.locked) { setLastError("Card is locked"); return; }
                                      startMoveTop(c.id, i, c.label);
                                    }}
                                    title={c.label}
                                    style={{
                                      minWidth: 80, height: 120,
                                      border: "1px solid #64748b",
                                      borderRadius: 6,
                                      background: "#111827",
                                      color: "#e5e7eb",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 11, padding: 4, textAlign: "center",
                                      cursor: (isMyTurn && focusPlayerId === myId) || (moving?.row === "top")
                                        ? "pointer"
                                        : "default",
                                      opacity: c.locked ? 0.6 : 1,
                                    }}
                                  >
                                    {/* Lock toggle (owner only) */}
                                    {canEditTop && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          sockRef.current!.emit(
                                            "board:toggleCardLock",
                                            { cardId: c.id, locked: !c.locked },
                                            (res: { ok: boolean; error?: string }) => {
                                              if (!res?.ok) setLastError(res?.error || "Toggle card lock failed");
                                            }
                                          );
                                        }}
                                        title={c.locked ? "Unlock card" : "Lock card"}
                                        style={{
                                          position: "absolute", top: 2, left: 2, zIndex: 5,
                                          fontSize: 10, padding: "1px 4px",
                                          borderRadius: 6, border: "1px solid #334155",
                                          background: c.locked ? "#7f1d1d" : "#1e293b",
                                          color: "#e5e7eb",
                                          cursor: "pointer",
                                        }}
                                      >
                                        {c.locked ? "🔒" : "🔓"}
                                      </button>
                                    )}

                                    {/* Strength badge */}
                                    {typeof c.strength === "number" && c.strength !== 0 && (
                                      <div
                                        style={{
                                          position: "absolute",
                                          bottom: 2,
                                          left: 2,
                                          zIndex: 4,
                                          fontSize: 11,
                                          lineHeight: 1,
                                          padding: "0 6px",
                                          borderRadius: 6,
                                          border: "1px solid #334155",
                                          background: "#1e293b",
                                          color: (c.strength ?? 0) < 0 ? "#fca5a5" : "#a7f3d0",
                                          whiteSpace: "nowrap",
                                          fontVariantNumeric: "tabular-nums",
                                        }}
                                        title={`Strength ${c.strength > 0 ? `+${c.strength}` : `${c.strength}`}`}
                                      >
                                        {c.strength > 0 ? `+${c.strength}` : `${c.strength}`}
                                      </div>
                                    )}

                                    {/* Strength controls (owner only, and not locked) */}
                                    {canEditTop && !c.locked && (
                                      <div style={{ position: "absolute", bottom: 2, right: 2, display: "flex", gap: 4, zIndex: 5 }}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); changeCardStrength(c.id, -1); }}
                                          title="−1 strength"
                                          style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#e5e7eb" }}
                                        >−</button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); changeCardStrength(c.id, +1); }}
                                          title="+1 strength"
                                          style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#e5e7eb" }}
                                        >+</button>
                                      </div>
                                    )}

                                    {c.label}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/*Location actions */}
                      <LocationActions
                        actions={loc.actions ?? []}
                        topSlots={loc.topSlots ?? 0}
                        hasTopCover={(loc.top?.length ?? 0) > 0}
                        locked={!!loc.locked}
                        isActive={viewingSelf && isMyTurn && !loc.locked}
                      />

          
                      {/* Bottom (your plays) */}
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Bottom</div>
                      <div
                        onClick={() => {
                          if(moving?.row === "bottom"){
                            dropMoveTo(i);
                            return;
                          }
                          if (!canDropHere) return;
                          if (selectedIds.size !== 1) return setLastError("Select exactly one card to play.");
                          playTo(i);
                        }}
                        style={{
                          border: canBottomAct ? "1px dashed #3b82f6" : "1px solid #475569",
                          borderRadius: 8,
                          padding: 6,
                          background: "#111827",
                          cursor: canDropHere && (moving || selectedIds.size > 0) ? "pointer" : "default",
                          minHeight: 130,
                        }}
                        title={
                          !viewingSelf ? "You can only play on your own board"
                          : !isMyTurn ? "Not your turn"
                          : loc.locked ? "Location is locked"
                          : (moving ? "Click to drop the moving card" :
                            selectedIds.size === 1 ? "Click to play the selected card here" : "Select exactly one card")
                        }
                      >
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {loc.bottom.length === 0 ? (
                            <span style={{ opacity: 0.6, fontSize: 12 }}>empty</span>
                          ) : (
                            loc.bottom.map(c => (
                              <div key={c.id} style={{ position: "relative", display: "inline-block" }}>
                                {/* card face */}
                                <div
                                  onClick={(e) => {
                                    //don't trigger play
                                    e.stopPropagation();               
                                    if (!isMyTurn || focusPlayerId !== myId) return;
                                    if (c.locked) { setLastError("Card is locked"); return; }
                                    startMove(c.id, i, c.label);
                                  }}
                                  title={c.label}
                                  style={{
                                    minWidth: 80, height: 120,
                                    border: "1px solid #64748b",
                                    borderRadius: 6,
                                    background: "#0b1220",
                                    color: "#e5e7eb",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 11, padding: 4, textAlign: "center",
                                    cursor: (isMyTurn && focusPlayerId === myId) ? "pointer" : "default",
                                    opacity: c.locked ? 0.6 : 1,
                                  }}
                                >
                                  {viewingSelf && isMyTurn && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sockRef.current!.emit("board:toggleCardLock", { cardId: c.id, locked: !c.locked }, (res: { ok: boolean; error?: string }) => {
                                          if (!res?.ok) setLastError(res?.error || "Toggle card lock failed");
                                        });
                                      }}
                                      title={c.locked ? "Unlock card" : "Lock card"}
                                      style={{
                                        position: "absolute", top: 2, left: 2, zIndex: 5,
                                        fontSize: 10, padding: "1px 4px",
                                        borderRadius: 6, border: "1px solid #334155",
                                        background: c.locked ? "#7f1d1d" : "#1e293b",
                                        color: "#e5e7eb",
                                        cursor: "pointer",
                                      }}
                                    >
                                      {c.locked ? "🔒" : "🔓"}
                                    </button>
                                  )}
                                  {typeof c.baseStrength === "number" && (
                                    <div
                                      style={{
                                        position: "absolute", top: 2, left: 2, zIndex: 5,
                                        fontSize: 11, padding: "0 6px", borderRadius: 6,
                                        border: "1px solid #334155", background: "#1e293b", color: "#e5e7eb",
                                      }}
                                      title="Printed strength"
                                    >
                                      {c.baseStrength}
                                    </div>
                                  )}

                                  {/* cost — top-right (cost can be 0; still display) */}
                                  <div
                                    style={{
                                      position: "absolute", top: 2, right: 2, zIndex: 5,
                                      fontSize: 11, padding: "0 6px", borderRadius: 6,
                                      border: "1px solid #334155", background: "#1e293b", color: "#e5e7eb",
                                    }}
                                    title="Cost"
                                  >
                                    {c.cost}
                                  </div>
                                  {typeof c.strength === "number" && c.strength !== 0 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        bottom: 2,
                                        left: 2,
                                        zIndex: 4,
                                        fontSize: 11,
                                        lineHeight: 1,
                                        padding: "0 6px",
                                        borderRadius: 6,
                                        border: "1px solid #334155",
                                        background: "#1e293b",
                                        color: (c.strength ?? 0) < 0 ? "#fca5a5" : "#a7f3d0",
                                        whiteSpace: "nowrap",
                                        fontVariantNumeric: "tabular-nums",
                                      }}
                                      title={`Strength ${c.strength > 0 ? `+${c.strength}` : `${c.strength}`}`}
                                    >
                                      {c.strength > 0 ? `+${c.strength}` : `${c.strength}`}
                                    </div>
                                  )}
                                  {focusPlayerId === myId && room?.game.phase === "playing" && !c.locked && (
                                    <div style={{ position: "absolute", bottom: 2, right: 2, display: "flex", gap: 4, zIndex: 5 }}>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); changeCardStrength(c.id, -1); }}
                                        title="−1 strength"
                                        style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#e5e7eb" }}
                                      >−</button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); changeCardStrength(c.id, +1); }}
                                        title="+1 strength"
                                        style={{ fontSize: 11, padding: "1px 6px", borderRadius: 6, border: "1px solid #334155", background: "#1e293b", color: "#e5e7eb" }}
                                      >+</button>
                                    </div>
                                  )}

                                  {c.label}
                                </div>
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
          
          <FateBar
            focusPlayer={focusPlayer ?? null}
            myId={myId}
            isMyTurn={isMyTurn}
            phase={room?.game.phase ?? "lobby"}
            players={room?.players ?? []}
            onStartFate={startFateFor}
            onReshuffleFate={reshuffleFateDiscardFor}
            onOpenFateDiscard={openFateDiscardFor}
          />

          <FatePanel
            open={!!fateTargetId && fateChoices.length > 0 && !fatePlacing}
            cards={fateChoices}
            onPlay={chooseFateCard}
            onCancel={cancelFate}
          />

          <FatePlaceBanner placing={fatePlacing} />

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
            {focusPlayer ? (
              <>
                {/* Header: shows whose hand we’re viewing + counts for that player */}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <strong>
                    {focusPlayerId === myId ? "Your hand" : `${focusPlayer.name}'s hand`}
                  </strong>

                  {/* Counts are always for the focus player */}
                  <span style={{ marginLeft: 8, opacity: 0.8 }}>
                    Deck: {focusPlayer.counts?.deck ?? 0}
                  </span>
                  <span style={{ opacity: 0.8 }}>· Discard: {focusPlayer.counts?.discard ?? 0}</span>

                  {/* Controls appear ONLY when viewing self */}
                  {focusPlayerId === myId && (
                    <>
                      <button onClick={drawOne} disabled={!isMyTurn} style={{ marginLeft: 8 }}>
                        Draw 1
                      </button>
                      <button
                        onClick={discardSelected}
                        disabled={!isMyTurn || selectedIds.size === 0}
                      >
                        Discard{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                      </button>
                      <button
                        onClick={reshuffleDiscard}
                        disabled={!isMyTurn || (room?.players.find(p => p.id === myId)?.counts?.discard ?? 0) === 0}
                        title="Shuffle your discard into your deck"
                      >
                        Shuffle Discard
                      </button>
                    </>
                  )}
                </div>

                {/* Cards area */}
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {focusPlayerId === myId ? (
                    // YOU: render real cards with your existing selection UI
                    myHand.length === 0 ? (
                      <span style={{ opacity: 0.7, fontSize: 12 }}>Your hand is empty</span>
                    ) : (
                      myHand.map((c) => {
                        const selected = selectedIds.has(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleSelect(c.id)}
                            title={c.label}
                            style={{
                              minWidth: 90, height: 130,
                              padding: 8,
                              border: selected ? "2px solid #3b82f6" : "1px solid #475569",
                              borderRadius: 8,
                              background: "#0b1220",
                              color: "#e5e7eb",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              textAlign: "center", fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            {c.label}
                          </div>
                        );
                      })
                    )
                  ) : (
                    // SPECTATING: render concealed tiles equal to their hand count
                    (focusPlayer.counts?.hand ?? 0) === 0 ? (
                      <span style={{ opacity: 0.7, fontSize: 12 }}>
                        {focusPlayer.name}'s hand is empty
                      </span>
                    ) : (
                      Array.from({ length: focusPlayer.counts.hand }).map((_, idx) => (
                        <div
                          key={idx}
                          title="Hidden card"
                          style={{
                            minWidth: 90, height: 130,
                            padding: 8,
                            border: "1px solid #475569",
                            borderRadius: 8,
                            background:
                              "repeating-linear-gradient(135deg, #626886ff, #061027ff 10px, #0e1b36ff 10px, #02050cff 20px)",
                            color: "#94a3b8",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            textAlign: "center", fontSize: 12,
                            userSelect: "none",
                          }}
                        >
                        </div>
                      ))
                    )
                  )}
                </div>
              </>
            ) : (
              <span style={{ opacity: 0.7 }}>No player focused.</span>
            )}
          </div>

          
          <DiscardModal
            open={showDiscard}
            cards={discardCards}
            canTake={canTakeFromThisDiscard}
            onTakeCard={(card) => takeFromDiscard(card.id)}
            onClose={() => setShowDiscard(false)}
          />
          <FateDiscardModal
            open={showFateDiscard}
            cards={fateDiscardCards}
            onClose={() => setShowFateDiscard(false)}
            onTake={(card) => {
              if (!fateDiscardTarget) return;
              startFateFromDiscard(fateDiscardTarget, card.id);
            }}
            targetName={room?.players.find(p => p.id === fateDiscardTarget)?.name ?? "player"}
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

          {/*action log */}
          <div
            style={{
              marginTop: 12,
              border: "1px solid #334155",
              borderRadius: 12,
              padding: 12,
              background: "#111827",
              color: "#e5e7eb",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Action log</h3>
            <div
              style={{
                marginTop: 8,
                maxHeight: 240,
                overflowY: "auto",
                display: "grid",
                gap: 6,
              }}
            >
              {logItems.length === 0 ? (
                <div style={{ opacity: 0.7, fontSize: 12 }}>No actions yet.</div>
              ) : (
                logItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ fontSize: 12, opacity: item.type === "undo" ? 0.75 : 1 }}
                    title={new Date(item.ts).toLocaleString()}
                  >
                    <span style={{ opacity: 0.7, marginRight: 6 }}>
                      {new Date(item.ts).toLocaleTimeString()}
                    </span>
                    <span>
                      <strong>{item.actorName}</strong>: {item.text}
                    </span>
                  </div>
                ))
              )}
            </div>
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
  canTake = false,
  onTakeCard,
}: {
  open: boolean;
  cards: Card[];
  onClose: () => void;
  canTake?: boolean;
  onTakeCard?: (card: Card) => void;
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
          {canTake && <span style={{ fontSize: 12, opacity: 0.75 }}>Click a card to add to your hand</span>}
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
                onClick={() => { if (canTake && onTakeCard) onTakeCard(c); }}
                title={
                  canTake ? "Click to add this card to your hand"
                          : c.label
                }
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
                  cursor: canTake ? "pointer" : "default",
                  opacity: canTake ? 1 : 0.9,
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
                {!canTake && (
                  <div style={{ position: "absolute", bottom: 6, fontSize: 11, opacity: 0.6 }}>
                    view only
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
function InfoBar({
  focusPlayer,
  myId,
  isMyTurn,
  phase,
  onChangePower,
}: {
  focusPlayer: Player | null;
  myId: string | null;
  isMyTurn: boolean;
  phase: RoomState["game"]["phase"];
  onChangePower: (delta: number) => void;
}) {
  if (!focusPlayer) return null;
  const viewingSelf = focusPlayer.id === myId;
  const power = typeof focusPlayer.power === "number" ? focusPlayer.power : 0;

  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 10,
        background: "#111827",
        color: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <strong style={{ whiteSpace: "nowrap" }}>
         {viewingSelf ? "" : "Viewing: " + focusPlayer.name}
      </strong>
      <span style={{ opacity: 0.8 }}>Pawn: L{(focusPlayer.board.moverAt ?? 0) + 1}</span>
      <span style={{ opacity: 0.8 }}>Power: {power}</span>
      

      {viewingSelf && phase === "playing" && (
        <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
          <button onClick={() => onChangePower(-1)} disabled={!isMyTurn && power <= 0}>-1</button>
          <button onClick={() => onChangePower(+1)}>+1</button>
        </div>
      )}
      <span style={{ marginLeft: "auto", opacity: 0.8 }}>
        {phase === "playing"
          ? (isMyTurn ? "Your turn" : "Waiting…")
          : phase === "lobby"
          ? "Lobby"
          : "Ended"}
      </span>
    </div>
  );
}
function FateBar({
  focusPlayer,
  myId,
  isMyTurn,
  phase,
  players,
  onStartFate,        // choose a target (self allowed)
  onReshuffleFate,    // reshuffle fate discard → fate deck (for a given player)
  onOpenFateDiscard,  // open fate discard viewer (for a given player)
}: {
  focusPlayer: Player | null;
  myId: string | null;
  isMyTurn: boolean;
  phase: "lobby" | "playing" | "ended";
  players: Player[];
  onStartFate: (targetId: string) => void;
  onReshuffleFate: (playerId: string) => void;
  onOpenFateDiscard: (playerId: string) => void;
}) {
  if (!focusPlayer) return null;

  const viewingSelf = focusPlayer.id === myId;
  const fateDeck   = focusPlayer.counts?.fateDeck    ?? 0;
  const fateDisc   = focusPlayer.counts?.fateDiscard ?? 0;

  // local UI for the target picker
  const [pickOpen, setPickOpen] = useState(false);

  const canAct = phase === "playing" && isMyTurn;

  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 10,
        background: "#0b1220",
        color: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
      }}
    >
      <strong>Fate</strong>

      {/* Counts for the FOCUSED player */}
      <span style={{ opacity: 0.85 }}>Deck: {fateDeck}</span>
      <span style={{ opacity: 0.85 }}>· Discard: {fateDisc}</span>
      {!viewingSelf && (
        <span style={{ opacity: 0.6 }}>
          · Target: {focusPlayer.name}
        </span>
      )}

      {/* Start Fate (self or others) */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setPickOpen(v => !v)}
          disabled={!canAct}
          title={canAct ? "Choose a player to Fate (self allowed)" : "Your turn required"}
        >
          Fate…
        </button>
        {pickOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 20,
              minWidth: 180,
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#111827",
              boxShadow: "0 12px 24px rgba(0,0,0,.35)",
              padding: 6,
            }}
          >
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => { setPickOpen(false); onStartFate(p.id); }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid transparent",
                  background: "transparent",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
                title={p.id === myId ? "You can Fate yourself" : "Fate this player"}
              >
                {p.name}{p.id === myId ? " (you)" : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* View fate discard (of the focused player) */}
      <button
        onClick={() => onOpenFateDiscard(focusPlayer.id)}
        title="View fate discard"
      >
        Open Discard
      </button>

      {/* Reshuffle (for the focused player) */}
      <button
        onClick={() => onReshuffleFate(focusPlayer.id)}
        disabled={!canAct || fateDisc === 0}
        title={fateDisc === 0 ? "Fate discard is empty" : "Shuffle fate discard into fate deck"}
      >
        Shuffle Discard
      </button>

      <span style={{ marginLeft: "auto", opacity: 0.75 }}>
        {phase === "playing"
          ? (isMyTurn ? "Your turn" : "Waiting…")
          : phase === "lobby"
          ? "Lobby"
          : "Ended"}
      </span>
    </div>
  );
}
function FatePanel({
  open,
  cards,
  onPlay,
  onCancel,
}: {
  open: boolean;
  cards: Card[];
  onPlay: (card: Card) => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 10,
        background: "#111827",
        color: "#e5e7eb",
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Fate: choose a card to play</strong>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={onCancel}>Cancel</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {cards.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No cards available</div>
        ) : (
          cards.map((c) => (
            <div
              key={c.id}
              title={c.label}
              style={{
                position: "relative",
                minWidth: 120, height: 160, padding: 8,
                border: "1px solid #475569", borderRadius: 8,
                background: "#1f2937", color: "#f1f5f9",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, textAlign: "center",
              }}
            >
              {c.label}
              <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 6 }}>
                <button onClick={() => onPlay(c)} title="Play this fate card">Play</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
function FatePlaceBanner({
  placing,
}: {
  placing: { targetId: string; cardId: string; label: string } | null;
}) {
  if (!placing) return null;
  return (
    <div
      style={{
        border: "1px dashed #3b82f6",
        borderRadius: 10,
        padding: 8,
        background: "#0b1220",
        color: "#e5e7eb",
        marginBottom: 12,
      }}
    >
      Placing <strong>{placing.label}</strong>: click a location <em>Top</em> on the target’s board.
    </div>
  );
}
function FateDiscardModal({
  open,
  cards,
  onClose,
  onTake,
  targetName,
}: {
  open: boolean;
  cards: Card[];
  onClose: () => void;
  onTake: (card: Card) => void;
  targetName: string;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
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
          <strong>Fate discard — {targetName} ({cards.length})</strong>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={onClose}>Close</button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
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
                  minWidth: 100,
                  height: 140,
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
                <div style={{ position: "absolute", bottom: 6, right: 6, display: "flex", gap: 6 }}>
                  <button onClick={() => onTake(c)} title="Take this card to start fate">
                    Take
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
function LocationActions({
  actions,
  topSlots = 0,
  hasTopCover,
  locked,
  isActive, // your turn + viewing self + not locked
}: {
  actions: ActionKind[];
  topSlots?: number;
  hasTopCover: boolean;
  locked?: boolean;
  isActive: boolean;
}) {
  const baseOpacity = locked ? 0.45 : isActive ? 1 : 0.75;

  return (
    <div
      style={{
        margin: "6px 0",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "6px 8px",
        borderRadius: 8,
        background: "#0b1220",
        border: "1px solid #334155",
        opacity: baseOpacity,
      }}
      title={
        locked
          ? "Location locked"
          : isActive
          ? "Available actions on this space"
          : "Actions on this space (view-only)"
      }
    >
      {actions.length === 0 ? (
        <span style={{ fontSize: 12, color: "#94a3b8" }}>No actions</span>
      ) : (
        actions.map((a, idx) => {
          const blocked = hasTopCover && idx < topSlots; // 👈 first topSlots turn red if any Top cards
          return (
            <span
              key={`${a}-${idx}`}
              style={{
                fontSize: 12,
                lineHeight: 1,
                padding: "4px 8px",
                borderRadius: 999,
                border: `1px solid ${blocked ? "#7f1d1d" : "#475569"}`,
                background: "#111827",
                color: blocked ? "#f87171" : "#e5e7eb",
                whiteSpace: "nowrap",
              }}
              title={blocked ? "Blocked by Hero (Top covered)" : "Action"}
            >
              {ACTION_LABELS[a]}
            </span>
          );
        })
      )}
      {locked && (
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#fca5a5" }}>🔒 Locked</span>
      )}
    </div>
  );
}