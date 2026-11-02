// The contract between server and client.
//
// server/src/protocol.ts and web/src/protocol.ts are deliberately identical, so each
// package still builds on its own. server/test/protocol.test.ts fails if they drift.

export type CardType = "Ally" | "Item" | "Condition" | "Effect" | "Hero" | "Cheat" | "Guardian" | "Curse" | "Ingredient" | "Maui" | "Omnidroid" | "Prince" | "Prisoner" | "Relic" | "Remote" | "Titan";

export type Card = {
  id: string;
  type: CardType;
  label: string;
  desc: string;
  cost: number | null;
  baseStrength: number | null;
  strength: number; //adjustment on top of baseStrength
  locked: boolean;
  ignoresLock?: boolean; //must be played even to a locked location
};

export type ActionKind =
  | "gain1" | "gain2" | "gain3"
  | "play"
  | "draw2"
  | "fate"
  | "discard"
  | "moveItemAlly"
  | "moveHero"
  | "vanquish"
  | "activate";

export type LocationIndex = 0 | 1 | 2 | 3;

export type Location = {
  id: string;
  name: string;
  locked: boolean;
  actions: ActionKind[];
  topSlots: number;
  top: Card[];
  bottom: Card[];
};

export type Board = {
  moverAt: LocationIndex;
  locations: [Location, Location, Location, Location];
};

export type CharacterPreview = {
  id: string;
  name: string;
  locations: { name: string; actions: ActionKind[]; topSlots?: number }[];
};

export type Phase = "lobby" | "playing" | "ended";
export type GameMeta = { phase: Phase; turn: number; activePlayerId: string | null };

export type PublicPlayer = {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  characterId: string;
  won: boolean;
  reacting: boolean;
  power: number;
  trust: number;
  counts: { deck: number; hand: number; discard: number; fateDeck: number; fateDiscard: number };
  discardTop: Card | null;
  handPublic: boolean;
  publicHand: Card[] | null;
  board: Board;
};

export type RoomState = { roomId: string; ownerId: string; players: PublicPlayer[]; game: GameMeta };

//an open fate action, known only to the player running it
export type Pending =
  | { kind: "fate"; targetId: string; targetName: string; cards: Card[]; chosenId: string | null }
  | { kind: "peek" | "sift"; targetId: string; targetName: string; cards: Card[] };

export type SelfState = { roomId: string; hand: Card[]; pending: Pending | null };

export type ChatMsg = { id: string; ts: number; playerId: string; name: string; text: string };

export type LogItem = {
  id: string;
  ts: number;
  actorId: string;
  actorName: string;
  type: string;
  text: string;
  undoable: boolean;
};

//what a client keeps so it can reclaim its seat after losing its connection
export type Seat = { roomId: string; playerId: string; token: string };

export type ServerEvents = {
  "room:state": (state: RoomState) => void;
  "room:self": (self: SelfState) => void;
  "room:log": (payload: { items: LogItem[] }) => void;
  "chat:history": (payload: { roomId: string; messages: ChatMsg[] }) => void;
  "chat:msg": (payload: { roomId: string; msg: ChatMsg }) => void;
};

//every event a client can send, with what it sends and what comes back
export type ClientEvents = {
  "meta:getCharacters": { payload: unknown; result: { characters: CharacterPreview[] } };

  "room:create": { payload: { name: string }; result: Seat };
  "room:join": { payload: { roomId: string; name: string }; result: Seat };
  "room:resume": { payload: { roomId: string; token: string; takeOver: boolean }; result: Seat };
  "room:leave": { payload: unknown; result: void };
  "chat:send": { payload: { text: string }; result: void };

  "lobby:chooseCharacter": { payload: { characterId: string }; result: void };
  "lobby:setReady": { payload: { ready: boolean }; result: void };
  "lobby:start": { payload: unknown; result: void };

  "game:endTurn": { payload: unknown; result: void };
  "game:claimWin": { payload: unknown; result: void };
  "game:backToLobby": { payload: unknown; result: void };
  "game:draw": { payload: { count?: number | undefined }; result: void };
  "game:playToLocation": { payload: { cardId: string; locationIndex: LocationIndex }; result: void };
  "game:playEffect": { payload: { cardId: string }; result: void };
  "game:discard": { payload: { cardIds: string[] }; result: { discarded: number } };
  "game:moveCard": { payload: { cardId: string; from: LocationIndex; to: LocationIndex }; result: void };
  "game:removeCard": { payload: { cardId: string; from: LocationIndex }; result: void };
  "game:reshuffleDeck": { payload: unknown; result: void };
  "reaction:end": { payload: unknown; result: void };

  "pile:getDiscard": { payload: { playerId: string }; result: { cards: Card[] } };
  "pile:takeFromDiscard": { payload: { cardId: string }; result: void };
  "log:undoSelf": { payload: unknown; result: void };

  "power:change": { payload: { delta: number }; result: void };
  "trust:change": { payload: { delta: number }; result: void };
  "pawn:set": { payload: { to: LocationIndex }; result: void };
  "card:deltaStrength": { payload: { cardId: string; delta: number }; result: void };
  "board:toggleLocationLock": { payload: { index: LocationIndex; locked?: boolean | undefined }; result: void };
  "board:toggleCardLock": { payload: { cardId: string; locked?: boolean | undefined }; result: void };
  "board:moveTop": { payload: { cardId: string; from: LocationIndex; to: LocationIndex }; result: void };
  "board:discardTop": { payload: { locationIndex: LocationIndex; cardId: string }; result: void };

  "fate:start": { payload: { targetId: string }; result: void };
  "fate:startFromDiscard": { payload: { targetId: string; cardId: string }; result: void };
  "fate:choosePlay": { payload: { cardId: string }; result: void };
  "fate:placeSelected": { payload: { locationIndex: LocationIndex }; result: void };
  "fate:discardBoth": { payload: unknown; result: void };
  "fate:discardSelected": { payload: unknown; result: void };
  "fate:cancel": { payload: unknown; result: void };
  "fate:getDiscard": { payload: { playerId: string }; result: { cards: Card[] } };
  "fate:reshuffleDeck": { payload: { playerId: string }; result: void };
  "fateDiscard:return": { payload: { playerId: string; cardId: string }; result: void };

  "fatePeek:start": { payload: { targetId: string; count: number; reshuffleFirst?: boolean | undefined }; result: void };
  "fatePeek:confirm": { payload: { orderIds: string[] }; result: void };
  "fatePeek:cancel": { payload: unknown; result: void };

  "fateSift:start": { payload: { targetId?: string | undefined }; result: void };
  "fateSift:choose": { payload: { discardId: string }; result: void };
  "fateSift:cancel": { payload: unknown; result: void };

  "fateFindHero:start": { payload: { targetId: string }; result: { found: boolean; targetName: string; revealed: number } };

  "char:toggleHandReveal": { payload: unknown; result: { next: boolean } };
  "lotso:flipBuzz": { payload: unknown; result: void };
};

export type EventName = keyof ClientEvents;
export type Payload<E extends EventName> = ClientEvents[E]["payload"];
export type Result<E extends EventName> = ClientEvents[E]["result"];
export type Ack<R> = ({ ok: true } & (R extends void ? unknown : R)) | { ok: false; error: string };
