import type { ActionKind, Board, Card, CardType, ChatMsg, GameMeta, LocationIndex } from "./protocol";

export type CardTemplate = {label: string; type: CardType; description?: string; cost?: number | null; strength?: number | null; copies?: number; ignoresLock?: boolean};
export type LocationTemplate = {name: string; actions: ActionKind[]; topSlots?: number};
export type CharacterTemplate = {id: string; name: string; deck: CardTemplate[]; fateDeck: CardTemplate[]; locations: LocationTemplate[]};

export type Zones = {deck: Card[]; hand: Card[]; discard: Card[]; fateDeck: Card[]; fateDiscard: Card[]};

export type Player = {
  id: string; //stable for the whole game, unlike a socket id
  token: string; //secret that proves this seat is yours, never broadcast
  socketId: string | null; //null while disconnected
  graceTimer?: NodeJS.Timeout; //removes the player if they do not come back
  name: string;
  ready: boolean;
  characterId: string;
  zones: Zones;
  board: Board;
  power: number;
  trust: number;
  won: boolean;
  handPublic: boolean;
  reacting: boolean; //resolving a Condition on someone else's turn
};

//an open fate action. Only one can run at a time; the drawn cards live here until it ends
export type Session =
  | {kind: "fate"; actorId: string; targetId: string; drawn: Card[]; chosenId?: string; source: "deck" | "discard"}
  | {kind: "peek"; actorId: string; targetId: string; drawn: Card[]}
  | {kind: "sift"; actorId: string; targetId: string; drawn: Card[]};

export type Room = {
  id: string;
  ownerId: string;
  players: Player[];
  game: GameMeta;
  messages: ChatMsg[];
  log: ActionEntry[];
  session?: Session;
};

export type ActionData =
  | {type: "draw"; cardIds: string[]}
  | {type: "play"; cardId: string; locationIndex: LocationIndex}
  | {type: "discard"; cardIds: string[]}
  | {type: "undo"; actionId: string}
  | {type: "move"; cardId: string; from: LocationIndex; to: LocationIndex; fromIndex: number}
  | {type: "remove"; cardId: string; from: LocationIndex; fromIndex: number; strength: number}
  | {type: "reshuffle"; moved: number}
  | {type: "retrieve"; cardId: string; fromIndex: number}
  | {type: "power"; delta: number; prev: number; next: number}
  | {type: "pawn"; prev: LocationIndex; next: LocationIndex}
  | {type: "lock"; target: "location"; loc: LocationIndex; prev: boolean; next: boolean}
  | {type: "lock"; target: "card"; loc: LocationIndex; cardId: string; prev: boolean; next: boolean}
  | {type: "strength"; cardId: string; loc: LocationIndex; prev: number; next: number; delta: number}
  | {type: "fate_reshuffle"; targetId: string; moved: number}
  | {type: "fate_play"; targetId: string; locationIndex: LocationIndex; discardedOther: boolean}
  | {type: "move_top"; from: LocationIndex; to: LocationIndex}
  | {type: "fate_discard_top"; locationIndex: LocationIndex}
  | {type: "fate_discard_both"; targetId: string}
  | {type: "fate_discard_one"; targetId: string; label: string}
  | {type: "play_effect"; cardId: string; label: string; openedReaction: boolean}
  | {type: "fate_peek"; targetId: string; count: number}
  | {type: "fate_return"; targetId: string; cardId: string}
  | {type: "reveal_hand"; next: boolean}
  | {type: "fate_sift"; targetId: string; discardedLabel: string; keptOnTop: boolean}
  | {type: "trust"; delta: number; prev: number; next: number}
  | {type: "char_flip_buzz"; loc: LocationIndex; fromLabel: string; toLabel: string}
  | {type: "fate_find_hero"; targetId: string; revealed: number; heroLabel: string | null};

export type ActionType = ActionData["type"];
export type ActionOf<T extends ActionType> = Extract<ActionData, {type: T}>;

export type ActionEntry = {id: string; ts: number; actorId: string; actorName: string; data: ActionData};
