import { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react';
import {makeSocket} from "./socket";


type Player = {id: string; name: string; ready: boolean; characterId: string | null; counts: {deck: number; hand: number; discard: number; fateDeck?: number; fateDiscard?: number}; discardTop: Card | null; board: Board; power?: number; trust?: number; publicHand?: Card[] | null; handPublic?: boolean;};
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type RoomState = {roomId: string; ownerId: string; players: Player[]; game: GameMeta};
type WelcomeMsg = {id: string; ts: number};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string};
type Card = {id: string; label: string; type: CardType; faceUp: boolean; locked?: boolean; desc?: string; cost: number; baseStrength?: number | null; strength?: number};
type CardType = "Ally" | "Item" | "Condition" | "Effect" | "Hero" | "Cheat" | "Guardian" | "Curse" | "Ingredient" | "Maui" | "Omnidroid" | "Prince" | "Prisoner" | "Relic" | "Remote" | "Titan"
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
type CardFaceProps = {
  card: Card & { printedCost?: number | null };
  locked?: boolean;
  onClick?: () => void;
  canLock?: boolean;
  onToggleLock?: (nextLocked: boolean) => void;
  canAdjustStrength?: boolean;
  onAdjustStrength?: (delta: number) => void;
  size?: "sm" | "md";
  title?: string;
  showCost?: boolean;
};
type GuideEntry = { title: string; image: string; body: string};
const GUIDES: Record<string, GuideEntry> = {
  maleficent: {
    title: "Maleficent - Villain Guide",
    image: "/guides/maleficent.jpg",
    body: `Maleficent's Objective: Start your turn with a Curse at each location.
Curses: Curse is a card type unique to Maleficent. Curses are played to locations, and each one has an Ability that affects Heroes at that location. However, each Curse also has an action that will cause it to be discarded. So you'll need to strategize when and where to play each curse.
Multiple curses may be played to the same location, and a Curse may be moved using a Move an Item or Ally action. The three Curses are Forest of Thorns, Green Fire, and Dreamless Sleep.

Forest of Thorns: Forest of Thorns makes it difficult for opponents to play a Hero at its location because a Hero must have a Strength of 4 or more to be played there.

Green Fire: Green Fire is a very powerful Curse because Heroes cannot be played to its location.

Dreamless Sleep: Dreamless Sleep reduces the Strengths of all Heroes at its location by 2.
Note: You may move an Ally to a location without having to discard the Curse. Also, you can play Dreamless Sleep to a location that already has Allies without affecting the Allies or the Curse.

Other Cards: Vanish allows Maleficent to remain at a location, enabling her to take the same action two turns in a row. Raven is a powerful Ally to play as early as possible. At the start of each turn, you may move Raven and perform one action that is available at his new location.`,
  },
  captain: {
    title: "Captain Hook - Villain Guide",
    image: "/guides/captain.jpg",
    body: `Captain Hook's Objective: Defeat Peter Pan at the Jolly Roger.
In order to achieve this objective, you must unlock the Hangman's Tree location by playing the Never Land Map. Peter Pan must be played, either by you or an opponent, to Hangman's Tree. You will then need to move him to Mermaid Lagoon, then to Skull Rock, and finally to the Jolly Roger, where you must defeat him to win the game.

Special Setup: Place a Lock Token on Hangman's Tree, as that location is locked at the beginning of the game.

Peter Pan: When Peter Pan is revealed, he must immediately be played to Hangman's Tree, even if Hangman's Tree is still locked. If Peter Pan is one of the two cards drawn by an opponent while performing a Fate action targeting you, the opponent must play Peter Pan and discard the other card.

Never Land Map: When you play the Never Land Map, unlock Hangman's Tree by removing the Lock Token from the location.
Important: Peter Pan may not be moved from Hangman's Tree until it is unlocked.

Controlling your Fate: Unlike other Villains, Captain Hook can play and discard cards from his own Fate deck using Worthy Opponent, Give Them a Scare, and Obsession. Using these cards will help you reveal Peter Pan and bring him into your Realm as soon as possible.

Extra Actions: Cannon, Hook's Case, and Ingenious Device are Items that add extra action symbols to your Realm. After the Item has been played to a location, you may perform the extra action in addition to the other available actions there.`,
  },
  prince: {
    title: "Prince John - Villain Guide",
    image: "/guides/prince.jpg",
    body: `Prince John's Objective: Start your turn with at least 20 Power.

Prince John is all about greed, so he needs to accumulate Power. However, as tempting as it might be to save all the Power you can, you will need to spend some Power in order to win. Several Heroes can hinder Prince John's ability to gain Power. It is a good idea to play Allies, even before any Heroes have been played. By doing so, you will be prepared to Vanquish a Hero that is affecting your progress.

The Jail: Prince John's Realm has a location that can be used to his advantage. The Jail does not have any action symbols that can be covered by Heroes, making Heroes at that location less disruptive. Prince John has Imprison cards which allow him to move Heroes to The Jail in order to make actions available elsewhere.

It's Good to Be the King! Although Heroes can be disruptive to his plans, Prince John has several tricks up his sleeve. Cards such as Warrant, Sherriff of Nottingham, and Beautiful, Lovely Taxes allow him to profit from having Heroes in his Realm. Sometimes it pays to keep your enemies close!

Special Fate Cards: When Steal from the Rich is played, 4 Power is taken from Prince John and placed on any one Hero that is in his Realm. When a Hero that has Power on them is defeated, Prince John takes all of the Power back.The same Hero may be used to Steal from the Rich multiple times, which can lead to a big payoff when the Hero is defeated!

While Robin Hood is in Prince John's Realm, every time Prince John gains Power due to an action or card, he gains 1 less Power than he would normally gain. It is usually a good idea to defeat Robin Hood as soon as possible!

When Little John is played, 4 Power is taken from Prince John and placed on Little John's card. When Little John is defeated, Prince John takes all of the Power back. Waiting for just the right time to defeat Little John can help set up an unexpected victory!`,
  },
  lady: {
    title: "Lady Tremaine - Villain Guide",
    image: "/guides/lady.jpg",
    body: `Lady Tremaine's Objective: Marry Drizella or Anastasia to the Prince.

To achieve Lady Tremaine's Objective, the Prince must be played from her Fate deck to The Ballroom, which must be unlocked by playing Invitation From the King, and you must move Ball Gown Anastasia to The Ballroom. While there, you must activate the Wedding Bells card.

Special Setup: Place a Lock Token on The Ballroom. This location is locked at the beginning of the game. Lady Tremaine cannot move to The Ballroom until it becomes unlocked.

Going to the Ball: Once The Ballroom is unlocked by playing Invitation From the King, The Ballroom cannot be re-locked.
Only four characters can be played or moved to The Ballroom: The Prince (who is played there immediately when revealed), Ball Gown Cinderella, Ball Gown Drizella, and Ball Gown Anastasia. While in play, Ball Gown Cinderella prevents Ball Gown Drizella or Ball Gown Anastasia from entering The Ballroom. This card has no effect if they are already there. Sweet Nightingale is a powerful Fate card that may slow your progress to The Ballroom by moving any Ally to a new location.
Ball Gown Cinderella, Ball Gown Drizella, and Ball Gown Anastasia can only be played by first playing Cinderella, Drizella, or Anastasia in their everyday dresses then discarding them to play their Ball Gown versions to the same location. This swap requires a Play a Card action. There can never be two versions of a character in play at the same time.
Important: Fairy Godmother can play Ball Gown Cinderella even if Cinderella is not in play. If this occurs, you may play Ball Gown Cinderella to any unlocked location.

Trapped!: Cards like Lucifer, The Key, and Trapped allow you to place a Trapped Token on a Hero in your Realm. When a Hero has a Trapped Token, their Ability is ignored, as if the card has no Ability at all. The card still remains in play and blocks your actions.
Ball Gown Cinderella cannot be Trapped by any card, although she can still be moved using the Activate action of The Key. Lady Tremaine has no Vanquish actions. However, players can use Activate actions to discard or defeat Fate cards from play. Cards such as Lady Tremaine's Cane, Midnight, and You Little Thief all remove specific Hero and Item cards from your Realm.

Glass Slippers: Unlike other Items in the Fate card deck, Glass Slippers do not attach to a Hero. You cannot win the game while a Glass Slipper is in your Realm. You can remove a Glass Slipper by Activating Lady Tremaine's Cane. Note: The Prince card is a Prince, not a Hero. The Prince is not affected by cards targeting Heroes.
`,
  },
  mother: {
    title: "Mother Gothel - Villain Guide",
    image: "/guides/mother.jpg",
    body: `Mother Gothel's Objective: Start your turn with at least 10 Trust.
    
Special Setup: Place the Rapunzel Tile at Rapunzel's Tower.

Trust: Mother Gothel wants to keep Rapunzel close, so she needs Rapunzel to trust her.

Rapunzel: Rapunzel is a unique Hero because she is already in your Realm at the start of the game, and she is never discarded. Like other Heroes, she blocks actions at her location and may be defeated by using a Vanquish action. Hoever, when Rapunzel is defeated, instead of discarding her, move her to Rapunzel's Tower.
Important: At the end of Mother Gothel's turn, move Rapunzel one location toward Corona. If you cannot move Rapunzel because she is already at Corona, Mother Gothel loses 1 Trust.

Controlling Rapunzel: Mother Gothel is able to gain Trust easily when Rapunzel is at Rapunzel's Tower, and keeping her away from Corona is important. Mother Gothel has several ways she controls Rapunzel's location. Mother Knows Best prevents Rapunzel from moving toward Corona at the end of that turn. Patchy Stabbington and Sideburns Stabbington move Rapunzel to Rapunzel's Tower and are powerful Allies that can be used to defeat Heroes. Now I'm The Bad Guy moves Rapunzel to Rapunzel's Tower. Mother Gothel loses 1 Trust, but it might be helpful in combination with other actions. 

Gaining Trust: There are several cards that can gain Trust. When Hair Brush is played or moved to Rapunzel's location, gain 1 Trust. This item is good to play early as it can keep gaining Trust when it is in your Realm. I Love You Most gains 1 Trust if Mother Gothel is at Rapunzel's location. It is most effective when played at Rapunzel's Tower to gain an additional Trust. Let Down Your Hair can gain you Trust or move Rapunzel to help keep her away from Corona. Misdirection gains 1 Trust but moves Rapunzel toward Corona, so it should be used strategically to avoid losing Trust later. Crown can be used as a way to gain Power each time a Hero is defeated at that location. You can instead choose to discard Crown to gain 1 Trust. Revenge allows you to perform a Vanquish action and gain 1 Trust if a Hero other than Rapunzel is defeated.

Strategy Tips: Some cards are most effective if played when Rapunzel is at Rapunzel's Tower. Sincer Rapunzel will move toward Corona at the end of your turn, moving her to Rapunzel's Tower or keeping her there will allow you to gain more Trust from those cards. Playing Effect or Condition cards and using Allies to defeat Rapunzel can move her to Rapunzel's Tower.`,
  },
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
  const [fatePeekOpen, setFatePeekOpen] = useState(false);
  const [fatePeekTargetId, setFatePeekTargetId] = useState<string | null>(null);
  const [fatePeekTargetName, setFatePeekTargetName] = useState<string>("");
  const [fatePeekCards, setFatePeekCards] = useState<Card[]>([]);
  const [fatePeekOriginal, setFatePeekOriginal] = useState<Card[]>([]);
  const [siftOpen, setSiftOpen] = useState(false);
  const [siftCards, setSiftCards] = useState<Card[]>([]);
  const [siftTargetName, setSiftTargetName] = useState<string>("Player");




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

  const discardBothFate = () => {
    const s = sockRef.current!;
    s.emit("fate:discardBoth", {}, (res?: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Discard both failed");
      // clear local fate UI
      setFateChoices([]);
      setFateTargetId(null);
      setFatePlacing(null);
    });
  };

  const getSelectedSingleEffect = (hand: Card[], ids: Set<string>) => {
    if (ids.size !== 1) return null;
    const id = Array.from(ids)[0];
    const c = hand.find(x => x.id === id);
    if (!c) return null;
    return (c.type === "Effect" || c.type === "Condition") ? c : null;
  }

  const catById = useMemo(
    () => Object.fromEntries(catalog.map(c => [c.id, c] as const)),
    [catalog]
  );

  const startFatePeek = (targetId: string, count: number) => {
    const s = sockRef.current!;
    s.emit(
      "fatePeek:start",
      { targetId, count },
      (res: { ok: boolean; error?: string; cards?: Card[]; targetName?: string }) => {
        if (!res?.ok) return setLastError(res?.error || "Peek failed");
        setFatePeekTargetId(targetId);
        setFatePeekTargetName(res.targetName || "Player");
        setFatePeekOriginal(res.cards || []);
        setFatePeekCards(res.cards || []);
        setFatePeekOpen(true);
      }
    );
  };

  const confirmFatePeek = () => {
    const s = sockRef.current!;
    s.emit(
      "fatePeek:confirm",
      { orderIds: fatePeekCards.map(c => c.id) },
      (res: { ok: boolean; error?: string }) => {
        if (!res?.ok) return setLastError(res?.error || "Confirm failed");
        setFatePeekOpen(false);
        setFatePeekCards([]);
        setFatePeekOriginal([]);
        setFatePeekTargetId(null);
      }
    );
  };

  const cancelFatePeek = () => {
    const s = sockRef.current!;
    s.emit("fatePeek:cancel", {}, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Cancel failed");
      setFatePeekOpen(false);
      setFatePeekCards([]);
      setFatePeekOriginal([]);
      setFatePeekTargetId(null);
    });
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setFatePeekCards(cs => {
      const a = cs.slice();
      [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
      return a;
    });
  };

  const moveDown = (idx: number) => {
    setFatePeekCards(cs => {
      if (idx >= cs.length - 1) return cs;
      const a = cs.slice();
      [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]];
      return a;
    });
  };

  const resetPeek = () => {
    setFatePeekCards(fatePeekOriginal);
  };

  const openGuideForCharacter = (characterId: string | null | undefined) => {
    if (!characterId) { setGuideForId(null); setGuideOpen(true); return; }
    setGuideForId(characterId);
    setGuideOpen(true);
  };

  const closeGuide = () => setGuideOpen(false);

  const onHookPeek = () => {
    if (!myId) return setLastError("Not in a room");
    const s = sockRef.current!;
    s.emit(
      "fatePeek:start",
      { targetId: myId, count: 2 },
      (res: { ok: boolean; error?: string; cards?: Card[]; targetName?: string }) => {
        if (!res?.ok) return setLastError(res?.error || "Peek failed");

        // Open your existing Peek UI
        setFatePeekTargetId(myId);
        setFatePeekTargetName(res.targetName || "You");
        setFatePeekOriginal(res.cards || []);
        setFatePeekCards(res.cards || []);
        setFatePeekOpen(true);
      }
    );
  };

  const startTremaineSift = () => {
    const s = sockRef.current!;
    s.emit(
      "fateSift:start",
      {}, // self-target for now; extend later with { targetId }
      (res: { ok: boolean; error?: string; cards?: Card[]; targetName?: string }) => {
        if (!res?.ok) return setLastError(res?.error || "Sift failed");
        setSiftCards(res.cards || []);
        setSiftTargetName(res.targetName || "Player");
        setSiftOpen(true);
      }
    );
  };

  const chooseTremaineSift = (keepId?: string) => {
    const s = sockRef.current!;
    s.emit(
      "fateSift:choose",
      { keepId },
      (res: { ok: boolean; error?: string }) => {
        if (!res?.ok) return setLastError(res?.error || "Choose failed");
        setSiftOpen(false);
        setSiftCards([]);
        setSiftTargetName("");
      }
    );
  };

  const cancelTremaineSift = () => {
    const s = sockRef.current!;
    s.emit("fateSift:cancel", {}, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Cancel failed");
      setSiftOpen(false);
      setSiftCards([]);
    });
  };

  const onDiscardOne = (discardId: string) => {
    const s = sockRef.current!;
    s.emit("fateSift:choose", { discardId }, (res: { ok: boolean; error?: string }) => {
      if (!res?.ok) return setLastError(res?.error || "Sift choose failed");
      setSiftOpen(false);
      setSiftCards([]);
      setSiftTargetName("");
    });
  };

  const onTremainePlan = () => {
    if (!myId) return;
    const s = sockRef.current!;
    const meId = myId;

    //1: shuffle fate discard
    s.emit("fate:reshuffleDeck", { playerId: meId }, (r: { ok: boolean; error?: string }) => {
      if (!r?.ok) {
        setLastError(r?.error || "Shuffle failed");
        return;
      }

      //2: peek top 4
      s.emit(
        "fatePeek:start",
        { targetId: meId, count: 4 },
        (res: { ok: boolean; error?: string; cards?: Card[]; targetName?: string }) => {
          if (!res?.ok) {
            setLastError(res?.error || "Peek failed");
            return;
          }
          // Open your existing peek UI
          setFatePeekTargetId(meId);
          setFatePeekTargetName(res.targetName || "You");
          setFatePeekOriginal(res.cards || []);
          setFatePeekCards(res.cards || []);
          setFatePeekOpen(true);
        }
      );
    });
  };





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
  const selectedEffect = getSelectedSingleEffect(myHand, selectedIds);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideForId, setGuideForId] = useState<string | null>(null);
  const currentGuide: GuideEntry | null = guideForId ? (GUIDES[guideForId] ?? null) : null;
  const focusCharacterId = focusPlayer?.characterId ?? null;
  const focusCharacterName =
    focusCharacterId
      ? (catById?.[focusCharacterId]?.name ?? focusCharacterId)
      : "—";
  const showPublicHand = !!focusPlayer?.handPublic && Array.isArray(focusPlayer?.publicHand);


 

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

                  <HelpButton onClick={() => openGuideForCharacter(me.characterId)} />

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
            onOpenGuide={(characterId) => openGuideForCharacter(characterId ?? null)}
            characterName={focusCharacterName}
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
              <FateBar
                focusPlayer={focusPlayer}
                myId={myId}
                isMyTurn={isMyTurn}
                phase={room?.game.phase ?? "lobby"}
                players={room?.players ?? []}
                onStartFate={startFateFor}
                onReshuffleFate={reshuffleFateDiscardFor}
                onOpenFateDiscard={openFateDiscardFor}
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
                            minHeight: 220,
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
                                  <CardFace
                                    key={c.id}
                                    card={c}
                                    showCost={false} 
                                    locked={!!c.locked}
                                    onClick={() => {
                                      if (!isMyTurn || focusPlayerId !== myId) return;
                                      if (moving?.row === "top") { if (!loc.locked) dropMoveTop(i); return; }
                                      if (c.locked) { setLastError("Card is locked"); return; }
                                      startMoveTop(c.id, i, c.label);
                                    }}
                                    canLock={canEditTop}
                                    onToggleLock={(next) => {
                                      sockRef.current!.emit(
                                        "board:toggleCardLock",
                                        { cardId: c.id, locked: next },
                                        (res:{ok:boolean; error?:string}) => {
                                          if (!res?.ok) setLastError(res?.error || "Toggle card lock failed");
                                        }
                                      );
                                    }}
                                    canAdjustStrength={canEditTop && !c.locked}
                                    onAdjustStrength={(delta) => changeCardStrength(c.id, delta)}
                                    size="md"
                                  />
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
                          minHeight: 220,
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
                                <CardFace
                                  key={c.id}
                                  card={c}
                                  locked={!!c.locked}
                                  onClick={() => {
                                    if (!isMyTurn || focusPlayerId !== myId) return;
                                    if (c.locked) { setLastError("Card is locked"); return; }
                                    startMove(c.id, i, c.label);
                                  }}
                                  // show lock/± only if it's your turn AND you're viewing your own board
                                  canLock={viewingSelf && isMyTurn}
                                  onToggleLock={(next) => {
                                    sockRef.current!.emit("board:toggleCardLock",
                                      { cardId: c.id, locked: next },
                                      (res:{ok:boolean; error?:string}) => { if (!res?.ok) setLastError(res?.error || "Toggle failed"); }
                                    );
                                  }}
                                  canAdjustStrength={viewingSelf && isMyTurn && !c.locked}
                                  onAdjustStrength={(delta) => changeCardStrength(c.id, delta)}
                                  size="md"
                                />
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

          <FatePanel
            open={!!fateTargetId && fateChoices.length > 0 && !fatePlacing}
            cards={fateChoices}
            onPlay={chooseFateCard}
            onCancel={cancelFate}
            onDiscardBoth={fateChoices.length >= 2 ? discardBothFate : undefined}
          />

          <FatePlaceBanner placing={fatePlacing} />

          {/* HAND panel (dark) */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12, alignItems: "start" }}>

            <PlayerPanel
              viewingSelf={focusPlayerId === myId}
              characterName={
                focusPlayer
                  ? (catById?.[focusPlayer.characterId ?? ""]?.name ?? "")
                  : ""
              }
              characterId={focusPlayer?.characterId ?? null}
              isMyTurn={isMyTurn}
              onHookPeek={onHookPeek}
              onToggleReveal={() => {
                sockRef.current!.emit("char:toggleHandReveal", {}, (res: {ok:boolean; error?:string}) => {
                  if (!res?.ok) setLastError(res.error || "Toggle reveal failed");
                });
              }}
              handPublic={!!focusPlayer?.handPublic}
              onTremaineSift={startTremaineSift}
              onTremainePlan={onTremainePlan}
              trust={focusPlayer?.trust ?? 0}
              onChangeTrust={(delta) => {
                if (!myId) return;
                sockRef.current!.emit("trust:change", { delta }, (res:{ok:boolean; error?:string})=>{
                  if(!res?.ok) setLastError(res?.error || "Trust change failed");
                });
              }}
            />
            {/*Right hand content */}
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
                <DiscardPeek
                  player={focusPlayer}
                  myId={myId}
                  onOpen={() => openDiscard(focusPlayer.id)}
                  onReshuffle={
                  viewingSelf && isMyTurn
                    ? () => {
                        reshuffleDiscard();
                      }
                    : undefined
                }
                />
              )}
              {focusPlayer ? (
            
                <>
                  {/* Header: shows whose hand we’re viewing + counts for that player */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderBottom: "1px solid #243244",
                      paddingBottom: 6,
                      flexWrap: "wrap",
                      border: "1px solid #334155",
                      borderRadius: 12,
                      padding: 8,
                      background: "#111827",
                      color: "#e5e7eb",
                      marginBottom: 8,
                    }}
                  >
                    {/* LEFT: info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong>
                        {focusPlayerId === myId ? "Your hand" : `${focusPlayer!.name}'s hand`}
                      </strong>
                      <span style={{ marginLeft: 8, opacity: 0.8 }}>
                        Deck: {focusPlayer!.counts?.deck ?? 0}
                      </span>
                      <span style={{ opacity: 0.8 }}>· Discard: {focusPlayer!.counts?.discard ?? 0}</span>
                    </div>

                    <span style={{ marginLeft: "auto" }} />

                    {/* Controls appear ONLY when viewing self */}
                    {focusPlayerId === myId && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

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
                          onClick={() => {
                            if (!selectedEffect) return;
                            const s = sockRef.current!;
                            s.emit("game:playEffect", { cardId: selectedEffect.id }, (res: { ok: boolean; error?: string }) => {
                              if (!res?.ok) return setLastError(res?.error || "Play effect failed");
                              setSelectedIds(new Set());
                            });
                          }}
                          disabled={!isMyTurn || !selectedEffect}
                          title={selectedEffect ? "Resolve this effect and discard it" : "Select exactly one effect/condition in your hand"}
                        >
                          Play Effect
                        </button>
                      </div>
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
                            <div key={c.id}
                              style={{ border: selected ? "2px solid #3b82f6" : "1px solid #475569", borderRadius: 8 }}>
                            <CardFace
                              card={c}
                              locked={!!c.locked}
                              onClick={() => toggleSelect(c.id)}
                              canLock={false}
                              canAdjustStrength={false}
                              size="sm"
                            />
                          </div>
                          );
                        })
                      )
                    ) : (
                      // SPECTATING: render concealed tiles equal to their hand count
                      <>
                      { showPublicHand ? (
                        focusPlayer!.publicHand!.length === 0 ? (
                          <span style={{ opacity: 0.7, fontSize: 12 }}>
                            {focusPlayer!.name}'s hand is empty
                          </span>
                        ) : (
                          focusPlayer!.publicHand!.map(c => (
                            <div key={c.id} style={{ border: "1px solid #475569", borderRadius: 8 }}>
                              <CardFace
                                card={c}
                                locked={!!c.locked}
                                canLock={false}
                                canAdjustStrength={false}
                                size="sm"
                              />
                            </div>
                          ))
                        )
                      ) : (
                        // fallback: concealed tiles (what you already had)
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
                      )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <span style={{ opacity: 0.7 }}>No player focused.</span>
              )}
            </div>
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
            onReturnSelected={(card) => {
              const s = sockRef.current!;
              s.emit("fateDiscard:return", { playerId: fateDiscardTarget, cardId: card.id }, (res: { ok: boolean; error?: string }) => {
                if (!res?.ok) return setLastError(res?.error || "Return to deck failed");
                setShowFateDiscard(false);
              });
            }}
          />
          <FatePeekModal
            open={fatePeekOpen}
            targetName={fatePeekTargetName}
            cards={fatePeekCards}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onReset={resetPeek}
            onCancel={cancelFatePeek}
            onConfirm={confirmFatePeek}
          />
          <FateSiftModal
            open={siftOpen}
            cards={siftCards}
            targetName={siftTargetName}
            onClose={cancelTremaineSift}
            onDiscardOne={onDiscardOne}
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
        <GuideModal open={guideOpen} onClose={closeGuide} guide={currentGuide} />
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
  onReshuffle,
}: {
  player: Player | null;
  myId: string | null;
  onOpen: () => void;
  onReshuffle?: () => void;
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
      {typeof onReshuffle === "function" && (
        <button
          onClick={onReshuffle}
          disabled={count === 0}
          title={count === 0 ? "Discard is empty" : "Shuffle discard into deck"}
          style={{ marginRight: 6 }}
        >
          Shuffle Discard
        </button>
      )}
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
              <div key={c.id}
                onClick={() => { if (canTake && onTakeCard) onTakeCard(c);}}
                style={{ cursor: "pointer" }}>
              <CardFace
                card={c}
                locked={!!c.locked}
                canLock={false}               // HIDE lock icon
                canAdjustStrength={false}     // HIDE ± buttons
                size="sm"
                onClick={() => { if (canTake && onTakeCard) onTakeCard(c); }}
              />
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
  onOpenGuide,
  characterName,
}: {
  focusPlayer: Player | null;
  myId: string | null;
  isMyTurn: boolean;
  phase: RoomState["game"]["phase"];
  onChangePower: (delta: number) => void;
  onOpenGuide: (characterId: string | null | undefined) => void;
  characterName: string;
}) {
  if (!focusPlayer) return null;
  const viewingSelf = focusPlayer.id === myId;
  const power = typeof focusPlayer.power === "number" ? focusPlayer.power : 0;
  const leftTitle = viewingSelf
    ? `${characterName}`
    : `Viewing: ${focusPlayer.name} (${characterName})`;
  const statusText =
    phase !== "playing"
      ? (phase === "lobby" ? "Lobby" : "Ended")
      : isMyTurn
        ? (viewingSelf ? "Your turn" : "Your turn (spectating)")
        : "Waiting…";

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
      <strong style={{ whiteSpace: "nowrap" }}>{leftTitle}</strong>
      <HelpButton onClick={() => onOpenGuide(focusPlayer?.characterId ?? null)} />
      <span style={{ opacity: 0.8 }}>Pawn: L{(focusPlayer.board.moverAt ?? 0) + 1}</span>
      <span style={{ opacity: 0.8 }}>Power: {power}</span>
      

      <div style={{ display: "flex", alignItems: "center", minHeight: 40}}>
        {viewingSelf && isMyTurn && phase === "playing" ? (
          <div style={{ display: "flex", gap: 6, marginLeft: 6 }}>
            <button onClick={() => onChangePower(-1)}>-1</button>
            <button onClick={() => onChangePower(+1)}>+1</button>
          </div>
        ) : (
          <div style={{ height: 30, marginLeft: 6, visibility: "hidden" }}>
            <button>-1</button><button>+1</button>
          </div>
        )}
      </div>
      <span style={{ marginLeft: "auto", opacity: 0.8 }}>{statusText}</span>
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

  const canAct = phase === "playing" && isMyTurn && viewingSelf;
  const disabledReason = !isMyTurn ? "Not your turn" : (!viewingSelf ? "Switch to your board to act" : undefined);
  const [pickOpen, setPickOpen] = useState(false);


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
        gap: 10,
        marginBottom: 12,
      }}
    >

      {/* LEFT: info */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong>Fate</strong>
        <span style={{ opacity: 0.85 }}>Deck: {fateDeck}</span>
        <span style={{ opacity: 0.85 }}>· Discard: {fateDisc}</span>
        {!viewingSelf && (
          <span style={{ opacity: 0.6 }}>· Target: {focusPlayer!.name}</span>
        )}
      </div>

      <span style={{marginLeft: "auto"}}/>

      {/* Start Fate (self or others) */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={() => setPickOpen(true)}
          disabled={!canAct}
          title={canAct ? "Choose a player to Fate" : "Your turn required"}
        >
          Fate…
        </button>
      </div>
      <PlayerPickerModal
        open={pickOpen}
        title="Choose a player to Fate"
        players={players}
        myId={myId}
        onClose={() => setPickOpen(false)}
        onPick={(targetId) => {
          onStartFate(targetId);
          setPickOpen(false);
        }}
      />




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
        title={
          !canAct
            ? (disabledReason || "Disabled")
            : (fateDisc === 0 ? "Fate discard is empty" : "Shuffle fate discard into fate deck")
        }
      >
        Shuffle Discard
      </button>
    </div>
  );
}
function FatePanel({
  open,
  cards,
  onPlay,
  onCancel,
  onDiscardBoth,
}: {
  open: boolean;
  cards: Card[];
  onPlay: (card: Card) => void;
  onCancel: () => void;
  onDiscardBoth?: () => void;
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
        {onDiscardBoth && cards.length >= 2 && (   // ✅ use props, not outer vars
          <button
            onClick={onDiscardBoth}
            title="Send both revealed fate cards to discard"
            style={{ marginLeft: 6 }}
          >
            Discard Both
          </button>
        )}
        <button onClick={onCancel}>Cancel</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        {cards.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No cards available</div>
        ) : (
          cards.map((c) => (
            <div key={c.id} onClick={() => onPlay(c)} style={{ cursor: "pointer" }}>
              <CardFace
                card={c}
                showCost={false}
                canLock={false}
                canAdjustStrength={false}
                size="md"
                onClick={() => onPlay(c)}
              />
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
  onReturnSelected,
}: {
  open: boolean;
  cards: Card[];
  onClose: () => void;
  onTake: (card: Card) => void;
  targetName: string;
  onReturnSelected: (card: Card) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { if (open) setSelectedId(null); }, [open]);
  if (!open) return null;
  const selected = selectedId ? cards.find(c => c.id === selectedId) || null : null;
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
          <button
              onClick={() => selected && onTake(selected)}
              disabled={!selected}
              title={selected ? "Play selected fate card" : "Select a card first"}
            >
              Play
            </button>
            <button
              onClick={() => selected && onReturnSelected(selected)}
              disabled={!selected}
              title={selected ? "Return selected card to fate deck (reshuffle)" : "Select a card first"}
            >
              Return to Deck
            </button>
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
          ) : cards.map((c, idx) => {
            const isSel = c.id === selectedId;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                title="Select this card"
                style={{
                  cursor: "pointer",
                  border: isSel ? "2px solid #3b82f6" : "1px solid #475569",
                  borderRadius: 8, background: "#1f2937", color: "#f1f5f9",
                  minWidth: 100, height: 140, padding: 8,
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <div style={{ position: "absolute", top: 6, left: 8, fontSize: 11, opacity: 0.6 }}>
                  #{cards.length - idx}
                </div>
                {/* Fate cards: no cost, no lock/± */}
                <CardFace
                  card={c}
                  showCost={false}
                  canLock={false}
                  canAdjustStrength={false}
                  size="sm"
                />
              </div>
            );
          })}
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
        const isTop = idx < topSlots;
        const blocked = hasTopCover && isTop; 

        const border = blocked ? "#7f1d1d" : isTop ? "#9b6c2cff" : "#475569"; // red | amber | slate
        const color  = blocked ? "#f87171" : isTop ? "#ffd770ff" : "#e5e7eb"; // red | amber | light

        return (
          <span
            key={`${a}-${idx}`}
            style={{
              fontSize: 12,
              lineHeight: 1,
              padding: "4px 8px",
              borderRadius: 999,
              border: `1px solid ${border}`,
              background: "#111827",
              color,
              whiteSpace: "nowrap",
            }}
            title={
              blocked
                ? "Top slot blocked by a Hero"
                : isTop
                ? "Top slot (blocked when a Hero is here)"
                : "Bottom slot action"
            }
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
function CardFace({
  card,
  locked = false,
  onClick,
  canLock = false,
  onToggleLock,
  canAdjustStrength = false,
  onAdjustStrength,
  size = "md",
  title,
  showCost = true,
}: CardFaceProps) {
  const printedCost =
    card.printedCost !== undefined ? card.printedCost : card.cost; // fallback to cost if you haven’t added printedCost
  const hasPrintedCost = printedCost !== null && printedCost !== undefined;
  const hasBase = typeof card.baseStrength === "number"; // shows even if 0


  // sizing
  const dims =
    size === "sm"
      ? { w: 90, h: 130, font: 10, pad: 6 }
      : { w: 150, h: 200, font: 12, pad: 8 };
  const badgeBase: React.CSSProperties = {
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e5e7eb",
    borderRadius: 6,
    lineHeight: 1,
  };
  const strengthColor =
    (card.strength ?? 0) < 0 ? "#fca5a5" : "#a7f3d0";

  return (
    <div
      onClick={onClick}
      title={title ?? card.label}
      style={{
        position: "relative",
        width: dims.w,
        height: dims.h,
        padding: dims.pad,
        flexShrink: 0,
        border: "1px solid #475569",
        borderRadius: 8,
        background: "#0b1220",
        color: "#e5e7eb",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        gap: 6,
        textAlign: "center",
        cursor: onClick ? "pointer" : "default",
        opacity: locked ? 0.6 : 1,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)",
      }}
    >
      {/* Top-center: card type */}
      {card.type && (
        <div
          style={{
            position: "absolute",
            top: 2,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0 6px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#111827",
            color: "#e5e7eb",
            fontSize: 10,
            lineHeight: 1,
            letterSpacing: 0.5,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
          title={`Type: ${card.type}`}
        >
          {card.type}
        </div>
      )}

      {/* Cost (top-left) */}
      {showCost && hasPrintedCost && (
        <div
          style={{
            ...badgeBase,
            position: "absolute",
            top: 2,
            left: 2,
            padding: "0 6px",
            fontSize: 11,
          }}
          title="Cost"
        >
          {printedCost}
        </div>
      )}

      {/* Lock (top-right) */}
      {canLock && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.(!locked);
          }}
          title={locked ? "Unlock card" : "Lock card"}
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            fontSize: 10,
            padding: "1px 4px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: locked ? "#7f1d1d" : "#1e293b",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
        >
          {locked ? "🔒" : "🔓"}
        </button>
      )}

      {/* Content area: allow wrapping, no ellipsis */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 4,
          flex: 1,
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: dims.font + 1,
            lineHeight: 1.1,
            whiteSpace: "normal",
            overflow: "visible",
            overflowWrap: "anywhere",
          }}
        >
          {card.label}
        </div>

        {card.desc && (
          <div
            style={{
              fontSize: dims.font - 1,
              lineHeight: 1.25,
              opacity: 0.9,
              whiteSpace: "normal",
              overflow: "visible",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {card.desc}
          </div>
        )}
      </div>

      {/* Bottom-left: strength badge (only if non-zero) */}
      {hasBase && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: 4,
            padding: "0 6px",
            borderRadius: 6,
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#e5e7eb",
            fontSize: 11,
            lineHeight: 1,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
          title="Printed strength"
        >
          {card.baseStrength}
        </div>
      )}

      {/* Bottom-right: compact ± with matching numeric chip */}
      {canAdjustStrength && hasBase && (
        <div
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStrength?.(-1);
            }}
            title="−1 strength"
            style={{
              fontSize: 10,
              height: 20,
              minWidth: 20,
              padding: 0,
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e5e7eb",
              lineHeight: 1,
            }}
          >
            −
          </button>

          {/* matching chip to the left badge */}
          <div
            style={{
              ...badgeBase,
              padding: "0 6px",
              fontSize: 11,
              color: strengthColor,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
            title="Current strength"
          >
            {typeof card.strength === "number"
              ? card.strength > 0
                ? `+${card.strength}`
                : `${card.strength}`
              : "0"}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStrength?.(+1);
            }}
            title="+1 strength"
            style={{
              fontSize: 10,
              height: 20,
              minWidth: 20,
              padding: 0,
              borderRadius: 6,
              border: "1px solid #334155",
              background: "#1e293b",
              color: "#e5e7eb",
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
function FatePeekModal({
  open,
  targetName,
  cards,
  onMoveUp,
  onMoveDown,
  onReset,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  targetName: string;
  cards: Card[];
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onReset: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", zIndex: 100 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 95vw)",
          maxHeight: "80vh",
          overflowY: "auto",
          background: "#111827",
          color: "#e5e7eb",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <strong>Peek top {cards.length} — {targetName}</strong>
          <span style={{ opacity: 0.75, fontSize: 12 }}>Top is leftmost</span>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={onReset} title="Reset order">Reset</button>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} disabled={cards.length === 0} style={{ marginLeft: 6 }}>
            Confirm Order
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {cards.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No cards available</div>
          ) : (
            cards.map((c, idx) => (
              <div key={c.id} style={{ position: "relative" }}>
                <CardFace
                  card={c}
                  showCost={false}
                  canLock={false}
                  canAdjustStrength={false}
                  size="md"
                />
                {/* order badge */}
                <div style={{
                  position: "absolute", top: 6, left: 8, fontSize: 12,
                  background: "#1f2937", border: "1px solid #334155", borderRadius: 6, padding: "2px 6px"
                }}>
                  #{idx + 1}
                </div>
                {/* controls */}
                <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "center" }}>
                  <button onClick={() => onMoveUp(idx)} title="Move toward top (left)">↑</button>
                  <button onClick={() => onMoveDown(idx)} title="Move toward bottom (right)">↓</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
function PlayerPickerModal({
  open, title, players, myId, onPick, onClose, extra,
}: {
  open: boolean;
  title: string;
  players: Player[];
  myId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center", zIndex: 120,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          background: "#111827", color: "#e5e7eb",
          border: "1px solid #334155", borderRadius: 12, padding: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <strong>{title}</strong>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={onClose}>Close</button>
        </div>

        {extra}

        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {players.map(p => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              style={{
                textAlign: "left", padding: "8px 10px", borderRadius: 8,
                border: "1px solid #334155", background: "#0b1220", color: "#e5e7eb",
              }}
            >
              {p.name}{p.id === myId ? " (you)" : ""}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function GuideModal({
  open,
  onClose,
  guide,
}: {
  open: boolean;
  onClose: () => void;
  guide: GuideEntry | null;
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
        zIndex: 200,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1400px, 95vw)",
          maxHeight: "85vh",
          overflow: "hidden",
          background: "#0b1220",
          color: "#e5e7eb",
          border: "1px solid #334155",
          borderRadius: 12,
          boxShadow: "0 16px 40px rgba(0,0,0,.5)",
          display: "grid",
          gridTemplateColumns: "300px 1fr",
        }}
      >
        {/* header */}
        <div style={{ gridColumn: "1 / -1", padding: "10px 12px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center" }}>
          <strong>{guide?.title ?? "Strategy Guide"}</strong>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={onClose}>Close</button>
        </div>

        {/* image left */}
        <div style={{ borderRight: "1px solid #1f2937", padding: 12, display: "grid", placeItems: "center" }}>
          {guide?.image ? (
            <img
              src={guide.image}
              alt=""
              style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #334155" }}
            />
          ) : (
            <div style={{ opacity: 0.6 }}>No image</div>
          )}
        </div>

        {/* text right */}
        <div style={{ padding: 12, overflowY: "auto" }}>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {guide?.body ?? "No guide has been provided yet."}
          </div>
        </div>
      </div>

      {/* responsive tweak: stack on small screens */}
      <style>{`
        @media (max-width: 720px) {
          [role="dialog"] > div { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Open strategy guide"
      aria-label="Open strategy guide"
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: "1px solid #a1a1a1ff",
        color: "#e5e7eb",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        lineHeight: 1,
        fontSize: 14,
        cursor: "pointer",
        padding: 0,
      }}
    >
      ?
    </button>
  );
}
function PlayerPanel({
  viewingSelf,
  characterName,
  characterId,
  isMyTurn,
  onHookPeek,
  onToggleReveal,
  handPublic,
  onTremaineSift,
  onTremainePlan,
  trust,
  onChangeTrust,
}: {
  viewingSelf: boolean;
  characterName: string;
  characterId?: string | null;
  isMyTurn: boolean;
  onHookPeek: () => void;
  onToggleReveal: () => void;
  handPublic: boolean;
  onTremaineSift: () => void;
  onTremainePlan: () => void;
  trust?: number;
  onChangeTrust?: (delta: number) => void;
}) {
  const [open, setOpen] = useState(false);

  // Simple initials as avatar fallback
  const initials =
    (characterName || "?")
      .split(" ")
      .map(s => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "?";

  const menuRef = useRef<HTMLDivElement | null>(null);
  const caretRef = useRef<HTMLButtonElement | null>(null);
  const [placeRight, setPlaceRight] = useState(true);
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const r = menuRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - r.right;
    // need about ~220px; adjust if your menu is wider
    setPlaceRight(spaceRight >= 220);
  }, [open]);
  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;     // clicked inside menu
      if (caretRef.current?.contains(t)) return;    // clicked the caret
      setOpen(false);                               // clicked outside -> close
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  
  return (
    <div
      style={{
        width: 80,
        minWidth: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ position: "relative" }}>
        {/* Avatar */}
        <div
          title={characterName || "Character"}
          style={{
            width: 64,
            height: 64,
            borderRadius: "999px",
            border: "1px solid #334155",
            background: "#0b1220",
            color: "#e5e7eb",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 18,
            userSelect: "none",
          }}
        >
          {initials}
        </div>

        {/* Caret/menu trigger (disabled if not viewing self) */}
        <button
          ref={caretRef}
          onClick={() => setOpen(v => !v)}
          disabled={!viewingSelf}
          title={viewingSelf ? "Character actions" : "View your own board to use actions"}
          aria-label="Character actions"
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            width: 22,
            height: 22,
            borderRadius: "999px",
            border: "1px solid #334155",
            background: "#111827",
            color: "#e5e7eb",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            opacity: viewingSelf ? 1 : 0.6,
            cursor: viewingSelf ? "pointer" : "default",
            padding: 0,
            transform: open? "rotate(180deg)" : "none",
          }}
        >
          ▾
        </button>

        {/* Popover menu (stub) */}
        {open && (
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              zIndex: 30,
              minWidth: 180,
              border: "1px solid #334155",
              borderRadius: 8,
              background: "#111827",
              color: "#e5e7eb",
              boxShadow: "0 12px 24px rgba(0,0,0,.35)",
              padding: 6,
              ...(placeRight
                ? { top: 0, left: 72 }
                : { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
              ),
            }}
          >
            <div
              style={{
                padding: "6px 8px",
                fontSize: 12,
                opacity: 0.8,
                borderBottom: "1px solid #334155",
                marginBottom: 6,
              }}
            >
              Character actions
            </div>

            {/* Actions list */}
            {characterId === "lady" && (
              <>
                <button
                  onClick={onTremaineSift}
                  disabled={!viewingSelf || !isMyTurn}
                  title={!viewingSelf ? "View your own board to use actions" : (!isMyTurn ? "Your turn required" : "Look at top 2 fate cards, discard 1, keep 1 on top")}
                  style={btnStyle(viewingSelf && isMyTurn)}
                >
                  Invitation From the King
                </button>
                <button
                  onClick={onTremainePlan}
                  disabled={!viewingSelf || !isMyTurn}
                  title={
                    !viewingSelf ? "View your own board to use actions"
                    : !isMyTurn ? "Your turn required"
                    : "Shuffle fate discard into fate deck, then peek top 4 and reorder"
                  }
                  style={btnStyle(viewingSelf && isMyTurn)}
                >
                  I Never Go Back On My Word
                </button>
              </>
            )}
            {characterId === "captain" && (
              <button
                onClick={onHookPeek}
                disabled={!viewingSelf || !isMyTurn}
                title={
                  !viewingSelf ? "View your own board to use actions"
                  : !isMyTurn ? "Your turn required"
                  : "Look at the top 2 cards of your Fate deck and reorder them"
                }
                style={btnStyle(viewingSelf && isMyTurn)}
              >
                Give Them a Scare
              </button>
            )}

            {characterId === "maleficent" && (
              <button
                onClick={onToggleReveal}
                disabled={!viewingSelf}  // does not require turn; just your board
                title={viewingSelf ? "Toggle whether your hand is visible to others" : "View your own board to use actions"}
                style={btnStyle(viewingSelf)}
              >
                {handPublic ? "Hide Hand" : "Reveal Hand"}
              </button>
            )}

            {(!characterId || (characterId === "Prince John")) && (
              <button disabled style={btnStyle(false)} title="No character-specific actions yet">
                (No actions available)
              </button>
            )}

          </div>
        )}
      </div>

      {/* Tiny caption (wraps if long) */}
      <div
        style={{
          maxWidth: 72,
          textAlign: "center",
          fontSize: 11,
          color: "#cbd5e1",
          wordBreak: "break-word",
        }}
        title={characterName}
      >
        {characterName || "—"}
      </div>

      {/*gothel trust */}
      {characterId === "mother" && (
        <div
          style={{
            width: "100%", border:"1px solid #334155", borderRadius:8, padding:"6px 6px",
            background:"#0b1220", color:"#e5e7eb", display:"flex", flexDirection:"column", gap:6,
          }}
          title="Trust"
        >
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <strong style={{ fontSize:16 }}>Trust: {typeof trust === "number" ? trust : 0}</strong>
          </div>
          {viewingSelf && isMyTurn && onChangeTrust && (
            <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
              <button style={{width: 30, height: 30, padding: 0, fontSize:15}} onClick={()=>onChangeTrust(-1)}>-1</button>
              <button style={{width: 30, height: 30, padding: 0, fontSize:15}} onClick={()=>onChangeTrust(+1)}>+1</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: enabled ? "#e5e7eb" : "#9ca3af",
    cursor: enabled ? "pointer" : "not-allowed",
  };
}
function FateSiftModal({
  open,
  cards,
  targetName,
  onDiscardOne,
  onClose,
}: {
  open: boolean;
  cards: Card[];
  targetName: string;
  onDiscardOne: (discardId: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const twoCards = cards.slice(0, 2);
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center", zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 90vw)", maxHeight: "70vh", overflowY: "auto",
          background: "#111827", color: "#e5e7eb",
          border: "1px solid #334155", borderRadius: 12, padding: 12,
          boxShadow: "0 12px 30px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <strong>Fate Sift — {targetName}</strong>
          <span style={{ marginLeft: "auto" }} />
          <button onClick={onClose}>Cancel</button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
          Choose <em>one</em> card to discard. The other will be returned face down on top.
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {twoCards.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No cards to sift.</div>
          ) : (
            twoCards.map((c, idx) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onMouseEnter={() => setHoverId(c.id)}
                onMouseLeave={() => setHoverId(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDiscardOne(c.id); }}
                onClick={() => onDiscardOne(c.id)}
                title="Discard this card (the other goes on top)"
                style={{
                  position: "relative",
                  cursor: "pointer",
                  border: "1px solid " + (hoverId === c.id ? "#60a5fa" : "#475569"),
                  boxShadow: hoverId === c.id ? "0 0 0 2px rgba(96,165,250,.35)" : "none",
                  borderRadius: 8,
                  padding: 6,
                  transition: "box-shadow .12s ease, border-color .12s ease",
                }}
              >
                <div
                  style={{
                    position: "absolute", top: 6, left: 8, fontSize: 11, opacity: 0.7,
                  }}
                >
                  {idx === 0 ? "Top (1)" : "Next (2)"}
                </div>
                <CardFace
                  card={c}
                  showCost={false}
                  canLock={false}
                  canAdjustStrength={false}
                  size="md"
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


