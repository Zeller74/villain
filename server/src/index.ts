import {Server} from "socket.io";
import {nanoid} from "nanoid";

type Location = {id: string; name: string; bottom: Card[]; top: Card[]; locked?: boolean; actions?: ActionKind[]; topSlots?: number};
type Board = {moverAt: 0 | 1 | 2 | 3; locations: [Location, Location, Location, Location]}
type Card = {id: string; type: CardType; label: string; faceUp: boolean; locked?: boolean; desc?: string; cost: number; baseStrength?: number | null; strength?: number;};
type CardType = "Ally" | "Item" | "Condition" | "Effect" | "Hero" | "Cheat" | "Guardian" | "Curse" | "Ingredient" | "Maui" | "Omnidroid" | "Prince" | "Prisoner" | "Relic" | "Remote" | "Titan"
type Zones = {deck: Card[]; hand: Card[]; discard: Card[]; fateDeck: Card[]; fateDiscard: Card[]};
type Player = {id: string; name: string, ready: boolean; characterId: string | null; zones: Zones; board: Board; power: number; won?: boolean;};
type ChatMsg = {id: string; ts: number; playerId: string; name: string; text: string;}
type GameMeta = {phase: "lobby" | "playing" | "ended"; turn: number; activePlayerId: string | null};
type Room = {id: string; ownerId: string; players: Player[]; game: GameMeta; messages: ChatMsg[]; log: ActionEntry[]; fate?: FateSession; fatePeek?: FatePeekSession};
type ActionType = "draw" | "play" | "discard" | "undo" | "move" | "remove" | "reshuffle" | "retrieve" | "power" | "pawn" | "lock" | "strength" | "fate_reshuffle" | "fate_play" | "move_top" | "fate_discard_top" | "fate_discard_both" | "play_effect" | "fate_peek" | "fate_return";
type ActionEntry = {
  id: string;
  ts: number;
  actorId: string;
  type: ActionType;
  data:
    | { type: "draw"; cardIds: string[] }
    | { type: "play"; cardId: string; locationIndex: 0|1|2|3 }
    | { type: "discard"; cardIds: string[] }
    | { type: "undo"; actionId: string }
    | { type: "move"; cardId: string; from: 0|1|2|3; to: 0|1|2|3; fromIndex: number; toIndex: number }
    | { type: "remove"; cardId: string; from: 0|1|2|3; fromIndex: number }
    | { type: "reshuffle"; moved: number }
    | { type: "retrieve"; cardId: string; fromIndex: number }
    | { type: "power"; delta: number; prev: number; next: number }
    | { type: "pawn"; prev: 0|1|2|3; next: 0|1|2|3 }
    | { type: "lock"; target: "location"; loc: 0|1|2|3; prev: boolean; next: boolean }
    | { type: "lock"; target: "card"; loc: 0|1|2|3; row: "top"|"bottom"; cardId: string; prev: boolean; next: boolean}
    | { type: "strength"; cardId: string; loc: 0|1|2|3; row: "top"|"bottom"; prev: number; next: number; delta: number}
    | { type: "fate_reshuffle"; targetId: string; moved: number}
    | { type: "fate_play"; targetId: string; playedCardId: string; locationIndex: 0|1|2|3; discardedCardId?: string}
    | { type: "move_top"; cardId: string; from: 0|1|2|3; to: 0|1|2|3; fromIndex: number; toIndex: number }
    | { type: "fate_discard_top"; cardId: string; locationIndex: 0|1|2|3 }
    | { type: "fate_discard_both"; targetId: string; cardIds: string[] }
    | { type: "play_effect"; cardId: string }
    | { type: "fate_peek"; targetId: string; count: number}
    | { type: "fate_return"; targetId: string; cardId: string};

  undone?: boolean;
};
type LogItem = {id: string; ts: number; actorId: string; actorName: string; type: ActionType | "undo"; text: string}
type FateSession = {actorId: string; targetId: string; drawn: Card[]; chosenId?: string};
type FatePeekSession = { actorId: string; targetId: string; drawn: Card[]};
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
type CardTemplate = {label: string; type: CardType; description?: string; cost?: number| null; strength?: number| null; copies?: number};
type LocationTemplate = {name: string; actions: ActionKind[]; topSlots?: number;}
type CharacterTemplate = {id: string; name: string; deck: CardTemplate[]; fateDeck: CardTemplate[]; locations: LocationTemplate[]}
type CharacterPreview = {
  id: string;
  name: string;
  locations: { name: string; actions: ActionKind[]; topSlots?: number }[];
};


const PORT = Number(process.env.PORT ?? 3001);
const io = new Server(PORT, {
    cors: {origin: "http://localhost:5173", credentials: true}
});
const rooms = new Map<string, Room>();
const MAX_POWER = 50;

const CHARACTERS_DATA: readonly [
  CharacterTemplate,
  ...CharacterTemplate[]
] = [
  {
    id: "maleficent",
    name: "Maleficent",
    locations: [
      { name: "Forbidden Mountains", actions: ["moveItemAlly", "play", "gain1", "fate"], topSlots: 2 },
      { name: "Briar Rose's Cottage", actions: ["gain2", "moveItemAlly", "play", "discard"], topSlots: 2 },
      { name: "The Forest", actions: ["discard", "play", "gain3", "play"], topSlots: 2 },
      { name: "King Stefan's Castle", actions: ["gain1", "fate", "vanquish", "play"], topSlots: 2 },
    ],
    deck: [
      { label: "Cackling Goon", type: "Ally", description: "Cackling Goon gets +1 Strength for each Hero at his location.", cost: 1, strength: 1, copies: 3 },
      { label: "Dragon Form", type: "Effect", description: "Defeat a Hero with a Strength of 3 or less. If a Fate action targets you before your next turn, gain 3 Power.", cost: 3, strength: null, copies: 3 },
      { label: "Forest of Thorns", type: "Curse", description: "Heroes must have a Strength of 4 or more to be played to this location. Discard this Curse when a Hero is played to this location", cost: 2, strength: null, copies: 3 },
      { label: "Green Fire", type: "Curse", description: "Heroes cannot be played to this location. Discard this Curse if Maleficent moves to this location.", cost: 3, strength: null, copies: 3},
      { label: "Savage Goon", type: "Ally", description: "No additional Ability", cost: 3, strength: 4, copies: 3},
      { label: "Sinister Goon", type: "Ally", description: "Sinister Goon gets +1 Strength if there are any Curses at his location.", cost: 2, strength: 3, copies: 3},
      { label: "Vanish", type: "Effect", description: "On your next turn, Maleficent does not have to move to a new location", cost: 0, strength: null, copies: 3},
      { label: "Dreamless Sleep", type: "Curse", description: "Heroes at this location get -2 Strength. Discard this Curse when an Ally is played to this location.", cost: 3, strength: null, copies: 2},
      { label: "Malice", type: "Condition", description: "During their turn, if another player defeats a Hero with a Strength of 4 or more, you may play Malice. Defeat a Hero with a Strength of 4 or less.", cost: null, strength: null, copies: 2},
      { label: "Tyranny", type: "Condition", description: "During their turn, if another player has three or more Allies in their Realm, you may play Tyranny. Draw three crads into your hand, then discard any three cards.", cost: null, strength: null, copies: 2},
      { label: "Raven", type: "Ally", description: "Before Maleficent moves, you may move Raven to any location and perform one available action at his new location. Raven cannot perform Fate actions.", cost: 3, strength: 1, copies: 1},
      { label: "Spinning Wheel", type: "Item", description: "If a Hero is defeated at this location, gain Power equal to the Hero's Strength minus 1.", cost: 1, strength: null, copies: 1},
      { label: "Staff", type: "Item", description: "If Maleficent is at this location, the Cost to play an Effect or Curse is reduced by 1 Power.", cost: 1, strength: null, copies: 1},
    ],
    fateDeck: [
      { label: "Guards", type: "Hero", description: "When performing a Vanquish action to defeat Guards, at least two Allies must be used", cost: null, strength: 3, copies: 3},
      { label: "Sword of Truth", type: "Item", description: "When Sword of Truth is played attach it to a Hero with no other attached Items. That Hero gets +2 Strength. The Cost to play a Curse to this location is increased by 2 Power", cost: null, strength: 2, copies: 3},
      { label: "Once Upon a Dream", type: "Effect", description: "Discard a Curse from a location in Maleficent's Realm that has a Hero.", cost: null, strength: null, copies: 2},
      { label: "Aurora", type: "Hero", description: "When Aurora is played, reveal the top card of Maleficent's Fate deck. If it is a Hero, play it. Otherwise return it to the top of the deck.", cost: null, strength: 4, copies: 1},
      { label: "Fauna", type: "Hero", description: "When Fauna is played, you may discard Dreamless Sleep from her location.", cost: null, strength: 2, copies: 1},
      { label: "Flora", type: "Hero", description: "When Flora is played, Maleficent must reveal her hand. Until Flora is defeated. Maleficent must play with her hand revealed.", cost: null, strength: 3, copies: 1},
      { label: "King Hubert", type: "Hero", description: "When King Hubert is played, you may move one Ally from each adjacent location to his location", cost: null, strength: 3, copies: 1},
      { label: "King Stefan", type: "Hero", description: "When King Stefan is played, you may move Maleficent to any location.", cost: null, strength: 4, copies: 1},
      { label: "Merryweather", type: "Hero", description: "Curses cannot be played to Merryweather's location", cost: null, strength: 4, copies: 1},
      { label: "Prince Phillip", type: "Hero", description: "When Prince Phillip is played, you may discard all Allies from his location", cost: null, strength: 5, copies: 1},
    ],
  },
  {
    id: "captain",
    name: "Captain Hook",
    locations: [
      { name: "Jolly Roger", actions: ["gain1", "discard", "vanquish", "play"], topSlots: 2 },
      { name: "Skull Rock", actions: ["gain1", "play", "fate", "discard"], topSlots: 2 },
      { name: "Mermaid Lagoon", actions: ["play", "moveItemAlly", "gain3", "play"], topSlots: 2 },
      { name: "Hangman's Tree", actions: ["fate", "gain2", "moveHero", "play"], topSlots: 2 },
    ],
    deck: [
      { label: "Boarding Party", type: "Ally", description: "When performing a Vanquish action, Boarding Party may be used to defeat a Hero at their location or at an adjacent unlocked location.", cost: 2, strength: 2, copies: 3 },
      { label: "Give Them a Scare", type: "Effect", description: "Look at the top two cards of your Fate deck. Either discard both cards or return them to the top in any order.", cost: 1, strength: null, copies: 3},
      { label: "Swashbuckler", type: "Ally", description: "No additional Ability.", cost: 1, strength: 2, copies: 3},
      { label: "Worthy Opponent", type: "Effect", description: "Gain 2 Power. Reveal cards from the top of your Fate deck until you reveal a Hero. Play that Hero and discard the rest.", cost: 0, strength: null, copies: 3},
      { label: "Aye, Aye, Sir!", type: "Effect", description: "Move an Ally to an adjacent unlocked location", cost: 1, strength: null, copies: 2},
      { label: "Cannon", type: "Item", description: "This location gains Vanquish.", cost: 2, strength: null, copies: 2},
      { label: "Cunning", type: "Condition", description: "During their turn, if another player has an Ally with a Strength of 4 or more in their Realm, you may play Cunning. Play an Ally from your hand for free.", cost: null, strength: null, copies: 2},
      { label: "Cutlass", type: "Item", description: "When Cutlass is played, attach it to an Ally. That Ally gets +2 Strength.", cost: 1, strength: 2, copies: 2},
      { label: "Hook's Case", type: "Item", description: "This location gains: Gain 1 Power", cost: 2, strength: null, copies: 2},
      { label: "Obsession", type: "Condition", description: "During their turn, if another player defeats a Hero with a Strength of 4 or more, you may play Obsession. Reveal cards from the top of your Fate deck until you reveal a Hero. Either play or discard that Hero. Discard the rest.", cost: null, strength: null, copies: 2},
      { label: "Pirate Brute", type: "Ally", description: "No additional Ability.", cost: 3, strength: 4, copies: 2},
      { label: "Ingenious Device", type: "Item", description: "This location gains: Move Hero", cost: 2, strength: null, copies: 1},
      { label: "Mr. Starkey", type: "Ally", description: "When Mr. Starkey is played, you may move a Hero from his location to an adjacent unlocked location.", cost: 2, strength: 2, copies: 1},
      { label: "Never Land Map", type: "Item", description: "When Never Land Map is played, unlock Hangman's Tree. When you play an Item, you may discard Never Land Map instead of paying the Item's Cost.", cost: 4, strength: null, copies: 1},
      { label: "Smee", type: "Ally", description: "Smee gets +2 Strength if he is at the Jolly Roger", cost: 2, strength: 2, copies: 1},
    ],
    fateDeck: [
      { label: "Pixie Dust", type: "Effect", description: "When Pixie Dust is played, attach it to a Hero. That Hero gets +2 Strength", cost: null, strength: 2, copies: 3},
      { label: "Lost Boys", type: "Hero", description: "When performing a Vanquish action to defeat Lost Boys, at least two Allies must be used.", cost: null, strength: 4, copies: 2},
      { label: "Splitting Headache", type: "Effect", description: "Discard an Item from Captain Hook's Realm", cost: null, strength: null, copies: 2},
      { label: "Taunt", type: "Item", description: "When Taunt is played, attach it to a Hero. Captain Hook must defeat Heroes with Taunt before defeating other Heroes.", cost: null, strength: null, copies: 2},
      { label: "John", type: "Hero", description: "John gets +1 Strength if he has any Items attached to him.", cost: null, strength: 2, copies: 1},
      { label: "Michael", type: "Hero", description: "Michael gets +1 Strength for each location in Captain Hook's Realm that has a Hero, including Michael's location", cost: null, strength: 1, copies: 1},
      { label: "Peter Pan", type: "Hero", description: "When Peter Pan is revealed, you MUST IMMEDIATELY PLAY HIM to Hangman's Tree, even if it is locked. Any other Fate cards revealed during this action are discarded.", cost: null, strength: 8, copies: 1},
      { label: "Tick Tock", type: "Hero", description: "If Captain Hook moves to Tick Tock's location, Captain Hook must immediately discard his hand.", cost: null, strength: 5, copies: 1},
      { label: "Tinker Bell", type: "Hero", description: "When Tinker Bell is played, you may discard one Ally from her location.", cost: null, strength: 2, copies: 1},
      { label: "Wendy", type: "Hero", description: "All other Heroes in Captain Hook's Realm get +1 Strength.", cost: null, strength: 3, copies: 1},
    ],
  },
  {
    id: "prince",
    name: "Prince John",
    locations: [
      { name: "Sherwodd Forest", actions: ["gain1", "discard", "play", "fate"], topSlots: 2 },
      { name: "Friar Tuck's Church", actions: ["gain2", "play", "play", "moveItemAlly"], topSlots: 2 },
      { name: "Nottingham", actions: ["fate", "gain1", "vanquish", "play"], topSlots: 2 },
      { name: "The Jail", actions: ["gain3", "play", "discard"], topSlots: 0 },
    ],
    deck: [
      { label: "Beautiful, Lovely Taxes", type: "Effect", description: "Gain 1 Power for each Hero in your Realm", cost: 0, strength: null, copies: 3},
      { label: "Imprison", type: "Effect", description: "Move a Hero to The Jail", cost: 2, strength: null, copies: 3},
      { label: "Rhino Guards", type: "Ally", description: "No additional Ability", cost: 3, strength: 4, copies: 3},
      { label: "Warrant", type: "Item", description: "Gain 2 Power each time a Hero is played to this location.", cost: 1, strength: null, copies: 3},
      { label: "Wolf Archers", type: "Ally", description: "When performing a Vanquish action, Wolf Archers may be used to defeat a Hero at their location or at an adjacent location.", cost: 2, strength: 2, copies: 3},
      { label: "Bow and Arrows", type: "Item", description: "When Bow and Arrows is played, attach it to an Ally. That Ally gets +1 Strength. When that Ally would be discarded, discard this Item instead.", cost: 1, strength: 1, copies: 2},
      { label: "Cowardice", type: "Condition", description: "During their turn, if another player has three or more Allies", cost: null, strength: null, copies: 2},
      { label: "Greed", type: "Condition", description: "During their turn, if another player has 6 or more Power, you may play Greed. Gain 3 Power", cost: null, strength: null, copies: 2},
      { label: "Set a Trap", type: "Effect", description: "You may move an Ally to any location. Perform a Vanquish action.", cost: 1, strength: null, copies: 2},
      { label: "Golden Arrow", type: "Item", description: "When Golden Arrow is played, attach it to an Ally. When that Ally is used to defeat a Hero, gain 2 Power.", cost: 0, strength: null, copies: 1},
      { label: "Intimidation", type: "Effect", description: "Perform a Vanquish action, but do not discard the Allies used to defeat the Hero", cost: 2, strength: null, copies: 1},
      { label: "King Richard's Crown", type: "Item", description: "If Prince John is at this location, all card Costs are reduced by 1 Power.", cost: 1, strength: null, copies: 1},
      { label: "Nusty", type: "Ally", description: "All other Allies at Nutsy's location get +1 Strength", cost: 2, strength: 2, copies: 1},
      { label: "Sheriff of Nottingham", type: "Ally", description: "Before Prince John moves, you may move Sheriff of Nottingham to any location and gain 1 Power if there are any Heroes at his new location.", cost: 3, strength: 3, copies: 1},
      { label: "Sir Hiss", type: "Ally", description: "If Prince John is at Sir Hiss's location, you may perform one action that is covered by a Hero at that location.", cost: 2, strength: 2, copies: 1},
      { label: "Trigger", type: "Ally", description: "All other Allies at Trigger's location get -1 Strength.", cost: 2, strength: 4, copies: 1},
      
    ],
    fateDeck: [
      { label: "Clever Disguise", type: "Item", description: "When Clever Disguise is played, attach it to a Hero. That Hero cannot be defeated. At any time, Prince John may pay 2 Power to discard Clever Disguise.", cost: null, strength: null, copies: 3},
      { label: "Steal from the Rich", type: "Effect", description: "Take up to 4 Power from Prince John and put it on any one Hero. When that Hero is defeated, the Power is returned to Prince John.", cost: null, strength: null, copies: 3},
      { label: "Alan-A-Dale", type: "Hero", description: "All other Heroes in Prince John's Realm get +1 Strength.", cost: null, strength: 2, copies: 1},
      { label: "Friar Tuck", type: "Hero", description: "When Friar Tuck is played, you may discard all Warrants from his location. Prince John does not gain any Power from them.", cost: null, strength: 3, copies: 1},
      { label: "King Richard", type: "Hero", description: "Prince John cannot play Effects.", cost: null, strength: 5, copies: 1},
      { label: "Lady Kluck", type: "Hero", description: "Lady Kluck cannot be played or moved to The Jail.", cost: null, strength: 6, copies: 1},
      { label: "Little John", type: "Hero", description: "When Little John is played, you may take up to 4 Power from Prince John and put it on Little John. When Little John is defeated, the Power is returned to Prince John.", cost: null, strength: 5, copies: 1},
      { label: "Maid Marian", type: "Hero", description: "When Maid Marian is defeated, find Robin Hood and play him to the same location.", cost: null, strength: 3, copies: 1},
      { label: "Robin Hood", type: "Hero", description: "The amount of Power that Prince John gains from each card or action is reduced by 1 Power.", cost: null, strength: 5, copies: 1},
      { label: "Skippy", type: "Hero", description: "Wolf Archers cannot be used to defeat Skippy.", cost: null, strength: 2, copies: 1},
      { label: "Toby", type: "Hero", description: "When Toby is defeated, shuffle him back into Prince John's Fate deck.", cost: null, strength: 2, copies: 1},
    ],
  },
];

type CharacterId = (typeof CHARACTERS_DATA)[number]["id"];


const CHARACTERS = CHARACTERS_DATA.reduce((acc, c) => {
  acc[c.id as CharacterId] = c;
  return acc;
}, {} as { [K in CharacterId]: CharacterTemplate });

const DEFAULT_CHARACTER_ID: CharacterId = CHARACTERS_DATA[0].id;

function newRoomId(){
    return nanoid(6);
}

function isOwner(socket: any, room: Room){
    return socket.id === room.ownerId;
}

function allReady(room: Room){
    return room.players.length >= 1 && room.players.every(p => p.ready);
}

function emitRoomState(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  const publicPlayers = room.players.map((p) => {
    const deck        = p.zones?.deck         ?? [];
    const hand        = p.zones?.hand         ?? [];
    const discard     = p.zones?.discard      ?? [];
    const fateDeck    = p.zones?.fateDeck     ?? [];
    const fateDiscard = p.zones?.fateDiscard  ?? [];

    const board = p.board ?? { moverAt: 0, locations: [] as any };
    const locations = (board.locations ?? []).map((loc: any, idx: number) => ({
      id: loc?.id ?? `L${idx + 1}`,
      name: loc?.name ?? `Location ${idx + 1}`,
      locked: !!loc?.locked,
      actions: Array.isArray(loc?.actions) ? loc.actions : [],
      topSlots: typeof loc?.topSlots === "number" ? loc.topSlots : 0,
      top: Array.isArray(loc?.top) ? loc.top : [],
      bottom: Array.isArray(loc?.bottom) ? loc.bottom : [],
    }));

    const discardTop = discard.length ? discard[discard.length - 1] : null;

    return {
      id: p.id,
      name: p.name,
      ready: !!p.ready,
      characterId: (p.characterId as CharacterId) || DEFAULT_CHARACTER_ID,
      won: !!(p as any).won,
      power: p.power,
      counts: {
        deck: deck.length,
        hand: hand.length,
        discard: discard.length,
        fateDeck: fateDeck.length,
        fateDiscard: fateDiscard.length,
      },
      discardTop,
      board: {
        moverAt: typeof board.moverAt === "number" ? board.moverAt : 0,
        locations,
      },
    };
  });

  io.to(roomId).emit("room:state", {
    roomId: room.id,
    ownerId: room.ownerId,
    players: publicPlayers,
    game: room.game,
  });

  emitPrivateStates(io, roomId);
}

function emitPrivateStates(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.in(roomId).fetchSockets().then(sockets => {
    for (const s of sockets) {
      const me = room.players.find(p => p.id === s.id);
      if (!me) continue;
      s.emit("room:self", {
        roomId: room.id,
        hand: me.zones.hand,
        counts: {
          deck: me.zones.deck.length,
          hand: me.zones.hand.length,
          discard: me.zones.discard.length,
        }
      });
    }
  }).catch(() => {});
}

function leaveCurrentRoom(socket: any, io: Server, opts?: { reason?: string }) {
  const roomId = socket.data.roomId as string | null;
  if (!roomId) { socket.data.roomId = null; return; }

  const room = rooms.get(roomId);
  if (!room) { socket.data.roomId = null; return; }

  //remove player
  room.players = room.players.filter(p => p.id !== socket.id);

  //system message
  const text = `${socket.data.name ?? "Player"} disconnected${opts?.reason ? ` (${opts.reason})` : ""}.`;
  const sys: ChatMsg = { id: nanoid(8), ts: Date.now(), playerId: "system", name: "System", text };
  room.messages.push(sys);
  room.messages = room.messages.slice(-100);
  io.to(roomId).emit("chat:msg", { roomId, msg: sys });

  if (room.players.length === 0) {
    rooms.delete(roomId);
    console.log(`🧹 room ${roomId} deleted (empty)`);
  } else {
    //owner handoff
    if (room.ownerId === socket.id) {
        const first = room.players[0]
        if (first){
            room.ownerId = first.id;
        }
    }
    //active player handoff
    if (room.game.activePlayerId === socket.id) {
      const first = room.players[0];
      room.game.activePlayerId = first ? first.id : null;
    }
    emitRoomState(io, roomId);
  }

  socket.leave(roomId);
  socket.data.roomId = null;
}

function makeLocation(ix: number, label?: string): Location {
  return {
    id: nanoid(6),
    name: label ?? `Loc ${ix + 1}`,
    bottom: [],
    top: [],
    locked: false,
  };
}

function makeEmptyBoard(): Board {
  return {
    moverAt: 0,
    locations: [0,1,2,3].map(i => makeLocation(i)) as Board["locations"],
  };
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function reshuffleFromDiscardIntoDeck(p: Player): boolean {
  if (p.zones.deck.length > 0) return false;
  if (p.zones.discard.length === 0) return false;
  //move all discard to deck, face down, then shuffle
  p.zones.deck = p.zones.discard.splice(0).map(c => ({ ...c, faceUp: false }));
  shuffle(p.zones.deck);
  return true;
}

function buildLogItem(room: Room, e: ActionEntry): LogItem {
  const actor = room.players.find(p => p.id === e.actorId);
  const name = actor?.name ?? e.actorId.slice(0, 6);
  const actorName = room.players.find(p => p.id === e.actorId)?.name ?? "Player";

  if (e.undone) {
    return {
      id: e.id,
      ts: e.ts,
      actorId: e.actorId,
      actorName: name,
      type: "undo",
      text: `${name} undid their last action`,
    };
  }

  if (e.type === "draw" && e.data.type === "draw") {
    const n = e.data.cardIds.length;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "draw",
      text: `${name} drew ${n} card${n === 1 ? "" : "s"}`
    };
  }

  if (e.type === "play" && e.data.type === "play") {
    const k = e.data.locationIndex + 1;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "play",
      text: `${name} played a card to L${k}`
    };
  }

  if (e.type === "discard" && e.data.type === "discard") {
    const n = e.data.cardIds.length;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "discard",
      text: `${name} discarded ${n} card${n === 1 ? "" : "s"}`
    };
  }

  if (e.type === "undo" && e.data.type === "undo") {
    return { id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "undo",
      text: `${name} undid their last action` };
  }
  if (e.type === "move" && e.data.type === "move") {
    const from = e.data.from + 1;
    const to = e.data.to + 1;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "move",
      text: `${name} moved a card L${from} → L${to}`,
    };
  }
  if (e.type === "remove" && e.data.type === "remove") {
    const from = e.data.from + 1;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "remove",
      text: `${name} discarded a board card from L${from}`,
    };
  }
  if (e.type === "reshuffle" && e.data.type === "reshuffle") {
    const n = e.data.moved;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "reshuffle",
      text: `${name} reshuffled ${n} card${n===1 ? "" : "s"} into deck`,
    };
  }
  if (e.type === "retrieve" && e.data.type === "retrieve") {
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "retrieve",
      text: `${name} took a card from discard`,
    };
  }
  if (e.type === "power" && e.data.type === "power") {
    const d = e.data.delta;
    const sign = d >= 0 ? "+" : "−";
    const mag = Math.abs(d);
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "power",
      text: `${name} ${sign}${mag} power (${e.data.prev} → ${e.data.next})`,
    };
  }
  if (e.type === "pawn" && e.data.type === "pawn") {
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "pawn",
      text: `${name} moved pawn to L${e.data.next + 1}`,
    };
  }
  if (e.type === "lock" && e.data.type === "lock") {
    if (e.data.target === "location") {
      const verb = e.data.next ? "locked" : "unlocked";
      return { id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "lock",
        text: `${name} ${verb} L${e.data.loc + 1}` };
    } else {
      const verb = e.data.next ? "locked" : "unlocked";
      return { id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "lock",
        text: `${name} ${verb} a card on L${e.data.loc + 1}` };
    }
  }
  if (e.type === "strength" && e.data.type === "strength") {
    const d = e.data;
    const sign = d.delta >= 0 ? "+" : "−";
    const mag = Math.abs(d.delta);
    const now = d.next >= 0 ? `+${d.next}` : String(d.next);
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "strength",
      text: `${name} ${sign}${mag} strength on L${d.loc + 1} (now ${now})`,
    };
  }
  if (e.type === "fate_reshuffle" && e.data.type === "fate_reshuffle") {
    const d = e.data as Extract<ActionEntry["data"], { type: "fate_reshuffle" }>;
    const targetId = d.targetId;

    let targetName = "player";
    for (const p of room.players) {
      if (p.id === targetId) { targetName = p.name; break; }
    }

    const n = d.moved;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "fate_reshuffle",
      text: `${name} reshuffled ${n} fate card${n === 1 ? "" : "s"} for ${targetName}`,
    };
  }
  if (e.data.type === "fate_play") {
    const d = e.data as Extract<ActionEntry["data"], { type: "fate_play" }>;
    const targetName = room.players.find(pp => pp.id === d.targetId)?.name ?? "player";
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName, type: "fate_play",
      text: `${actorName} fated ${targetName}: played a fate card to L${d.locationIndex + 1}${d.discardedCardId ? " (discarded another)" : ""}`,
    };
  }
  if (e.data.type === "move_top") {
    const d = e.data;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName,
      type: "move_top",
      text: `${actorName} moved a top card from L${d.from + 1} to L${d.to + 1}`,
    };
  }
  if (e.data.type === "fate_discard_top") {
    const d = e.data;
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName,
      type: "fate_discard_top",
      text: `${actorName} discarded a top card from L${d.locationIndex + 1}`,
    };
  }
  if (e.type === "fate_discard_both" && e.data.type === "fate_discard_both") {
    const d = e.data as Extract<ActionEntry["data"], { type: "fate_discard_both" }>;
    const actor  = room.players.find(p => p.id === e.actorId);
    const name   = actor?.name ?? e.actorId.slice(0, 6);
    let targetName = "player";
    for (const p of room.players) { if (p.id === d.targetId) { targetName = p.name; break; } }

    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "fate_discard_both",
      text: `${name} discarded both fate cards for ${targetName}.`,
    };
  }
  if (e.type === "play_effect" && e.data.type === "play_effect") {
    const name = room.players.find(p => p.id === e.actorId)?.name ?? e.actorId.slice(0, 6);
    const cardId = e.data.cardId;
    let label = "a card";
    for (const p of room.players) {
      const inDiscard = p.zones.discard.find(c => c.id === cardId);
      const inHand = p.zones.hand.find(c => c.id === cardId);
      const onBoard = p.board.locations.some(loc =>
        loc.bottom.some(c => c.id === cardId) || loc.top.some(c => c.id === cardId)
      );
      if (inDiscard) { label = inDiscard.label; break; }
      if (inHand)    { label = inHand.label; break; }
      if (onBoard)   { label = "(board card)"; break; }
    }
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "play_effect",
      text: `${name} played ${label} (effect)`,
    };
  }
  if (e.type === "fate_peek" && e.data.type === "fate_peek") {
    const d = e.data;
    let targetName = "player";
    for (const p of room.players) { if (p.id === d.targetId) { targetName = p.name; break; } }
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "fate_peek",
      text: `${name} arranged the top ${d.count} of ${targetName}'s fate deck`,
    };
  }
  if (e.type === "fate_return" && e.data.type === "fate_return") {
    const d = e.data as Extract<ActionEntry["data"], { type: "fate_return" }>;
    let targetName = "player";
    for (const p of room.players) { if (p.id === d.targetId) { targetName = p.name; break; } }
    return {
      id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: "fate_return",
      text: `${name} returned a fate card to ${targetName}'s deck and reshuffled`,
    };
  }


  //fallback
  return {
    id: e.id, ts: e.ts, actorId: e.actorId, actorName: name, type: e.type,
    text: `${name} did ${e.type}`
  };
}

function emitRoomLog(io: Server, roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  // Broadcast a sanitized view (most recent first)
  const items: LogItem[] = room.log.slice(-25).map(e => buildLogItem(room, e)).reverse();
  io.to(roomId).emit("room:log", { items });
}

function pushLog(io: Server, roomId: string, entry: ActionEntry) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.log.push(entry);
  if (room.log.length > 25) room.log.splice(0, room.log.length - 25);
  emitRoomLog(io, roomId);
}

function shuffleDiscardIntoDeck(p: Player): number {
  const moved = p.zones.discard.length;
  if (moved === 0) return 0;
  const movedCards = p.zones.discard.splice(0).map(c => ({ ...c, faceUp: false }));
  p.zones.deck.push(...movedCards);   // append to existing deck
  shuffle(p.zones.deck);              // shuffle whole deck
  return moved;
}

function shuffleFateDiscardIntoDeck(p: Player): number {
  const moved = p.zones.fateDiscard.length;
  if (moved === 0) return 0;
  const movedCards = p.zones.fateDiscard.splice(0).map(c => ({ ...c, faceUp: true }));
  p.zones.fateDeck.push(...movedCards);
  shuffle(p.zones.fateDeck);
  return moved;
}

function drawFromFate(p: Player, n: number): Card[] {
  while (p.zones.fateDeck.length < n && p.zones.fateDiscard.length > 0) {
    shuffleFateDiscardIntoDeck(p);
  }
  const out: Card[] = [];
  for (let i = 0; i < n && p.zones.fateDeck.length > 0; i++) {
    const c = p.zones.fateDeck.pop()!;
    // Fate cards are revealed on draw; keep faceUp true.
    c.faceUp = true;
    out.push(c);
  }
  return out;
}

function advanceToNextActive(room: Room) : { wrapped: boolean } {
  const arr = room.players;
  const n = arr.length;
  if (n === 0) { room.game.activePlayerId = null; return { wrapped: false }; }

  const curIdx = room.game.activePlayerId
    ? arr.findIndex(p => p.id === room.game.activePlayerId)
    : -1;

  for (let step = 1; step <= n; step++) {
    const idx = (curIdx + step) % n;
    const p = arr[idx];
    if (p && !p.won) {
      room.game.activePlayerId = p.id;
      const wrapped = curIdx >= 0 ? idx <= curIdx : false;
      return { wrapped };
    }
  }

  // everyone won or no valid next
  room.game.activePlayerId = null;
  return { wrapped: false };
}

function expandDeck(templates: CardTemplate[]): Card[] {
  const out: Card[] = [];
  for (const t of templates) {
    const n = t.copies ?? 1;
    for (let i = 0; i < n; i++) {
      out.push({
        id: nanoid(8),
        label: t.label,
        type: t.type,
        faceUp: false,
        desc: t.description ?? "",
        cost: t.cost ?? 0,                 // cost always set
        baseStrength: t.strength ?? null,  // printed value or null
        strength: 0,                       // start with no adjustments
        locked: false,
      });
    }
  }
  return out;
}

function makeBoardFrom(locTpls: LocationTemplate[]): Board {
  const get = (i: number): LocationTemplate =>
    locTpls[i] ?? { name: `Location ${i + 1}`, actions: [], topSlots: 0 };

  const mk = (i: number, id: string): Location => {
    const t = get(i);
    return {
      id,
      name: t.name,
      locked: false,
      top: [],
      bottom: [],
      actions: t.actions,
      topSlots: (t.topSlots ?? Math.min(2, t.actions.length)),
    };
  };

  const l0 = mk(0, "L1");
  const l1 = mk(1, "L2");
  const l2 = mk(2, "L3");
  const l3 = mk(3, "L4");

  return { moverAt: 0, locations: [l0, l1, l2, l3] };
}

function isCharacterId(x: string | null | undefined): x is CharacterId {
  return !!x && (x in CHARACTERS);
}

function getCharacter(id: string | null | undefined): CharacterTemplate {
  const key: CharacterId = isCharacterId(id) ? id : DEFAULT_CHARACTER_ID;
  return CHARACTERS[key]!;
}

function nowId() { return nanoid(8); }



io.on("connection", (socket) => {
    console.log("Connected:", socket.id);
    socket.emit("Server:test message", {id: socket.id, ts: Date.now() });
    socket.on("disconnect", (reason) => {
        leaveCurrentRoom(socket, io, { reason: "disconnect" });
        console.log("Disconnected:", socket.id, reason);
    });
    socket.data.roomId = null as null | string;
    socket.data.name = null as null | string;
    //create a new room, autojoin, and ack with roomId
    socket.on("room:create", (payload: { name: string }, ack?: (res: { ok: boolean; roomId?: string; error?: string }) => void) => {
        const name = (payload?.name ?? "").trim();
        if (!name) {
            ack?.({ ok: false, error: "name required" });
            return;
        }
        if (socket.data.roomId) {
            leaveCurrentRoom(socket, io, { reason: "switching rooms" });
        }


        //make a new room
        const roomId = newRoomId();
        const room: Room = { id: roomId, ownerId: socket.id, players: [] , game: {phase: "lobby", turn: 1, activePlayerId: null}, messages: [], log: []};
        rooms.set(roomId, room);

        //join as player
        const player: Player = { id: socket.id, name, ready: false, characterId: null, zones: {deck: [], hand:[], discard: [], fateDeck: [], fateDiscard: []}, board: makeEmptyBoard(), power: 0 };
        room.players.push(player);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.name   = name;

        ack?.({ ok: true, roomId });
        emitRoomState(io, roomId);
        emitRoomLog(io, room.id);
        console.log(`Room ${roomId} created by ${name} (${socket.id})`);
    });
    //join by id
    socket.on("room:join", (payload: { roomId: string; name: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = (payload?.roomId ?? "").trim();
        const name   = (payload?.name ?? "").trim();
        const room   = rooms.get(roomId);
        if (!room) {
            ack?.({ ok: false, error: "room not found" });
            return;
        }
        if (!name) {
            ack?.({ ok: false, error: "name required" });
            return;
        }
        //avoid dupes
        if (!room.players.some(p => p.id === socket.id)) {
            room.players.push({id: socket.id, name, ready: false, characterId: DEFAULT_CHARACTER_ID, zones: {deck: [], hand: [], discard: [], fateDeck: [], fateDiscard: []}, board: makeEmptyBoard(), power: 0,});
            if (!room.game.activePlayerId && room.players.length > 0) {
                const first = room.players[0]
                if (first) room.game.activePlayerId = first.id;
            }
        }
        if (socket.data.roomId && socket.data.roomId !== roomId) {
            leaveCurrentRoom(socket, io, { reason: "switching rooms" });
        }


        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.name   = name;
        socket.emit("chat:history", {
            roomId,
            messages: room.messages
        });

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        emitRoomLog(io, room.id);
        console.log(`${name} (${socket.id}) joined room ${roomId}`);
    });
    socket.on("room:leave", (ack?: (res:{ok:boolean; error?:string})=>void) => {
        leaveCurrentRoom(socket, io, { reason: "left room" });
        ack?.({ ok: true });
    });
    socket.on("chat:send", (payload: {text: string}, ack?: (res: { ok: boolean; error?: string}) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        const raw = (payload?.text ?? "").trim();
        if (!raw) return ack?.({ ok: false, error: "empty message" });

        const text = raw.slice(0, 300);
        const msg: ChatMsg = {
        id: nanoid(8),
        ts: Date.now(),
        playerId: socket.id,
        name: socket.data.name ?? "Anonymous",
        text
        };

        room.messages.push(msg);
        //only last 100 msgs
        if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
        }

        io.to(roomId).emit("chat:msg", { roomId, msg });

        ack?.({ ok: true });
    });
    socket.on("lobby:chooseCharacter",(payload: { characterId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "lobby") return ack?.({ ok: false, error: "not in lobby" });

        const id = (payload?.characterId || "").trim();
        if (!id || !(id in CHARACTERS)) return ack?.({ ok: false, error: "invalid character id" });

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        me.characterId = id;
        ack?.({ ok: true });
        emitRoomState(io, roomId);
        console.log("chooseCharacter", socket.id, "→", id, "ok:", id in CHARACTERS);

        const sys: ChatMsg = { id: nanoid(8), ts: Date.now(), playerId: "system", name: "System", text: `${me.name} chose ${id}` };
        room.messages.push(sys); room.messages = room.messages.slice(-100);
        io.to(roomId).emit("chat:msg", { roomId, msg: sys });
    });
    socket.on("lobby:setReady",(payload: { ready: boolean }, ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "lobby") return ack?.({ ok: false, error: "not in lobby" });

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        me.ready = !!payload?.ready;
        ack?.({ ok: true });
        emitRoomState(io, roomId);
    });
    socket.on("lobby:start",(ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "lobby") return ack?.({ ok: false, error: "already started" });
        if (!isOwner(socket, room)) return ack?.({ ok: false, error: "owner only" });
        if (room.players.length < 2) return ack?.({ ok: false, error: "need at least 2 players" });
        if (!allReady(room)) return ack?.({ ok: false, error: "not all ready" });

        for (const p of room.players) {
          const ch = getCharacter(p.characterId);
          p.board = makeBoardFrom(ch.locations);
          p.zones.deck = expandDeck(ch.deck);
          p.zones.discard = [];
          p.zones.fateDeck = expandDeck(ch.fateDeck);
          p.zones.fateDiscard = [];
          p.zones.hand = [];
          shuffle(p.zones.deck);
          shuffle(p.zones.fateDeck);
        }

        //transition to playing
        room.game.phase = "playing";
        room.game.turn = 1;
        const first = room.players[0];
        room.game.activePlayerId = first ? first.id : null;

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        emitRoomLog(io, room.id);
        //\system message
        const sys: ChatMsg = { id: nanoid(8), ts: Date.now(), playerId: "system", name: "System", text: "Game started!" };
        room.messages.push(sys); room.messages = room.messages.slice(-100);
        io.to(roomId).emit("chat:msg", { roomId, msg: sys });
    });
    socket.on("game:endTurn", (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });

        if (room.game.activePlayerId !== socket.id) {
          return ack?.({ ok: false, error: "not your turn" });
        }

        const { wrapped } = advanceToNextActive(room);
        if (wrapped) room.game.turn += 1;

        ack?.({ ok: true });
        emitRoomState(io, roomId);
    });
    socket.on("game:draw", (payload: {count?: number} | undefined, ack?: (res: {ok: boolean; error?: string}) => void) =>{
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

        if (room.game.activePlayerId !== socket.id) {
          return ack?.({ ok: false, error: "not your turn" });
        }

        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        const n = Math.max(1, Math.min(5, Number(payload?.count ?? 1)));
        const drawnIds: string[] = [];  // collect while drawing
        for (let i = 0; i < n; i++) {
          if (me.zones.deck.length === 0) reshuffleFromDiscardIntoDeck(me);
          const card = me.zones.deck.pop();
          if (!card) break;
          const c = { ...card, faceUp: true };
          me.zones.hand.push(c);
          drawnIds.push(c.id);
        }
        ack?.({ ok: true });
        emitRoomState(io, roomId);
        pushLog(io, roomId, {
          id: nanoid(8),
          ts: Date.now(),
          actorId: socket.id,
          type: "draw",
          data: { type: "draw", cardIds: drawnIds },
        });
    });
    socket.on("game:playToLocation", (payload: {cardId: string; locationIndex: number}, ack?: (res: {ok: boolean; error?: string}) => void) =>{
        const roomId = socket.data.roomId as string | null;
        if (!roomId) return ack?.({ ok: false, error: "not in a room" });
        const room = rooms.get(roomId);
        if (!room) return ack?.({ ok: false, error: "room not found" });
        if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
        //only active player can play
        if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
        }
        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });
        const k = Number(payload?.locationIndex);
        if (!(k >= 0 && k < 4)) return ack?.({ ok: false, error: "bad location index" });

        const idx = me.zones.hand.findIndex(c => c.id === payload.cardId);
        if (idx === -1) return ack?.({ ok: false, error: "card not in hand" });
        

        //move card from hand to board
        const card = me.zones.hand.splice(idx, 1)[0]!;
        card.faceUp = true;

        const kk = (k as 0 | 1 | 2 | 3);
        const loc = me.board.locations[kk];
        if(!loc) return ack?.({ok: false, error: "bad location"});
        if (loc.locked) return ack?.({ ok: false, error: "location is locked" });
        loc.bottom.push(card);

        ack?.({ ok: true });
        emitRoomState(io, roomId);
        pushLog(io, roomId, {
          id: nanoid(8),
          ts: Date.now(),
          actorId: socket.id,
          type: "play",
          data: { type: "play", cardId: card.id, locationIndex: k as 0|1|2|3 },
        });
    });
    socket.on("game:discard", (payload: {cardId?: string; cardIds?: string[]} | undefined, ack?: (res: {ok: boolean; error?: string; discarded?: number}) => void) =>{
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      //only active player can discard
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      //normalize payload to an array of ids
      const ids = (payload?.cardIds && payload.cardIds.length > 0) ? payload.cardIds : (payload?.cardId ? [payload.cardId] : []);

      if (ids.length === 0) return ack?.({ ok: false, error: "no cards specified" });

      let count = 0;
      for (const id of ids) {
        const idx = me.zones.hand.findIndex(c => c.id === id);
        if (idx === -1) continue; //skip unknown
        const card = me.zones.hand.splice(idx, 1)[0]!;
        card.faceUp = true;
        me.zones.discard.push(card);
        count++;
      }

      if (count === 0) return ack?.({ ok: false, error: "card(s) not in hand" });

      ack?.({ ok: true, discarded: count });
      emitRoomState(io, roomId); //public counts + your private hand via room:self
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "discard",
        data: { type: "discard", cardIds: ids },
      });
    });
    socket.on("pile:getDiscard", (payload: {playerId: string}, ack?: (res: {ok: boolean; error?: string; cards?: Card[]}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });

      const pid = (payload?.playerId || "").trim();
      const target = room.players.find(p => p.id === pid);
      if (!target) return ack?.({ ok: false, error: "player not found" });

      const cards = target.zones.discard.slice().reverse();
      ack?.({ ok: true, cards });
    });
    socket.on("game:moveCard", (payload: {cardId: string; from: number; to: number}, ack?: (res: {ok: boolean; error?: string}) => void) =>{
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const from = Number(payload?.from);
      const to = Number(payload?.to);
      if (!(from >= 0 && from < 4) || !(to >= 0 && to < 4)) {
        return ack?.({ ok: false, error: "bad location index" });
      }
      if (from === to) {
        return ack?.({ ok: false, error: "moving within same location not supported" });
      }

      const fromLoc = me.board.locations[from];
      const toLoc = me.board.locations[to];
      if (!fromLoc || !toLoc) return ack?.({ ok: false, error: "bad locations" });

      const idx = fromLoc.bottom.findIndex(c => c.id === payload.cardId);
      if (idx === -1) return ack?.({ ok: false, error: "card not in source location (bottom)" });
      const srcCard = fromLoc.bottom[idx];
      if (srcCard?.locked) return ack?.({ ok: false, error: "card is locked" });
      if (toLoc.locked)    return ack?.({ ok: false, error: "destination locked" });


      const card = fromLoc.bottom.splice(idx, 1)[0]!;
      const toIndex = toLoc.bottom.length; // push to end for now
      toLoc.bottom.push(card);

      ack?.({ ok: true });
      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "move",
        data: { type: "move", cardId: card.id, from: from as 0|1|2|3, to: to as 0|1|2|3, fromIndex: idx, toIndex },
      });
    });
    socket.on("log:undoSelf", (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      const last = room.log[room.log.length - 1];
      if (!last) return ack?.({ ok: false, error: "nothing to undo" });
      if (last.actorId !== socket.id) return ack?.({ ok: false, error: "only your last action can be undone" });
      if (last.undone) return ack?.({ ok: false, error: "already undone" });

      const me = room.players.find(p => p.id === socket.id)!;
      if (last.type === "power" && last.data.type === "power") {
        return ack?.({ ok: false, error: "power cannot be undone" });
      }
      if (last.type === "reshuffle" && last.data.type === "reshuffle") {
        return ack?.({ ok: false, error: "reshuffle cannot be undone" });
      }
      if (last.type === "draw" && last.data.type === "draw") {
        const ids = last.data.cardIds;
        if (!ids.every(id => me.zones.hand.some(c => c.id === id))) {
          return ack?.({ ok: false, error: "cannot undo: cards already moved" });
        }
        for (let i = ids.length - 1; i >= 0; i--) {
          const id = ids[i];
          const idx = me.zones.hand.findIndex(c => c.id === id);
          const card = me.zones.hand.splice(idx, 1)[0]!;
          card.faceUp = false;
          me.zones.deck.push(card);
        }
      } else if (last.type === "play" && last.data.type === "play") {
        const { cardId, locationIndex } = last.data;
        const loc = me.board.locations[locationIndex];
        if (!loc) return ack?.({ ok: false, error: "bad location" });
        const idx = loc.bottom.findIndex(c => c.id === cardId);
        if (idx === -1) return ack?.({ ok: false, error: "card not on board anymore" });
        const card = loc.bottom.splice(idx, 1)[0]!;
        me.zones.hand.push(card);
      } else if (last.type === "discard" && last.data.type === "discard") {
        const ids = last.data.cardIds;
        for (let i = ids.length - 1; i >= 0; i--) {
          const id = ids[i];
          const top = me.zones.discard[me.zones.discard.length - 1];
          if (!top || top.id !== id) {
            return ack?.({ ok: false, error: "cannot undo: discard changed" });
          }
          const card = me.zones.discard.pop()!;
          me.zones.hand.push(card);
        }
      } else if (last.type === "move" && last.data.type === "move") {
        const { cardId, from, to, fromIndex } = last.data;
        const toLoc = me.board.locations[to];
        const fromLoc = me.board.locations[from];
        if (!toLoc || !fromLoc) return ack?.({ ok: false, error: "bad locations" });

        const j = toLoc.bottom.findIndex(c => c.id === cardId);
        if (j === -1) return ack?.({ ok: false, error: "card not in destination anymore" });

        const card = toLoc.bottom.splice(j, 1)[0]!;
        const insertAt = Math.min(Math.max(0, fromIndex), fromLoc.bottom.length);
        fromLoc.bottom.splice(insertAt, 0, card);
      } else if (last.type === "remove" && last.data.type === "remove") {
        const { cardId, from, fromIndex } = last.data;
        const fromLoc = me.board.locations[from];
        if (!fromLoc) return ack?.({ ok: false, error: "bad location" });

        const top = me.zones.discard[me.zones.discard.length - 1];
        if (!top || top.id !== cardId) {
          return ack?.({ ok: false, error: "cannot undo: discard changed" });
        }
        const card = me.zones.discard.pop()!;
        const insertAt = Math.min(Math.max(0, fromIndex), fromLoc.bottom.length);
        fromLoc.bottom.splice(insertAt, 0, card);
      } else if (last.type === "retrieve" && last.data.type === "retrieve") {
        const { cardId, fromIndex } = last.data;
        // Card must still be in hand to undo
        const idx = me.zones.hand.findIndex(c => c.id === cardId);
        if (idx === -1) return ack?.({ ok: false, error: "cannot undo: card moved from hand" });
        const card = me.zones.hand.splice(idx, 1)[0]!;
        const insertAt = Math.min(Math.max(0, fromIndex), me.zones.discard.length);
        me.zones.discard.splice(insertAt, 0, card);
      } else if (last.type === "pawn" && last.data.type === "pawn") {
        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });
        me.board.moverAt = last.data.prev;
      } else if (last.type === "lock" && last.data.type === "lock") {
        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });
        const d = last.data; // narrow once
        if (d.target === "location") {
          const i = d.loc as 0 | 1 | 2 | 3;
          const loc = me.board.locations[i];
          if (!loc) return ack?.({ ok: false, error: "bad location" });
          loc.locked = d.prev;
        } else if (d.target === "card") {
          const i = d.loc as 0 | 1 | 2 | 3;
          const loc = me.board.locations[i];
          if (!loc) return ack?.({ ok: false, error: "bad location" });
          const list = d.row === "top" ? loc.top : loc.bottom;
          const j = list.findIndex(c => c.id === d.cardId);
          if (j === -1) return ack?.({ ok: false, error: "card not found" });
          list[j]!.locked = d.prev;
        } else {
          return ack?.({ ok: false, error: "bad lock payload" });
        }
      } else if (last.type === "strength" && last.data.type === "strength") {
        const me = room.players.find(p => p.id === socket.id);
        if (!me) return ack?.({ ok: false, error: "player not found" });

        const d = last.data;
        const i = d.loc as 0|1|2|3;
        const loc = me.board.locations[i];
        if (!loc) return ack?.({ ok: false, error: "bad location" });

        const list = d.row === "top" ? loc.top : loc.bottom;
        const j = list.findIndex(c => c.id === d.cardId);
        if (j === -1) return ack?.({ ok: false, error: "card not found" });

        list[j]!.strength = d.prev;
        return ack?.({ ok: true });
      } else if (last.type === "play_effect" && last.data.type === "play_effect") {
        const d = last.data as Extract<ActionEntry["data"], { type: "play_effect" }>;
        const cardId = d.cardId;
        const j = me.zones.discard.findIndex(c => c.id === cardId);
        if (j === -1) return ack?.({ ok: false, error: "card not in discard" });
        const card = me.zones.discard.splice(j, 1)[0]!;
        card.faceUp = false;
        me.zones.hand.push(card);
      } else if (last.type === "fate_return" && last.data.type === "fate_return") {
          const d = last.data;
          const target = room.players.find(p => p.id === d.targetId);
          if (!target) return ack?.({ ok: false, error: "target not found for undo" });

          // locate the card in fateDeck
          const j = target.zones.fateDeck.findIndex(c => c.id === d.cardId);
          if (j === -1) return ack?.({ ok: false, error: "card not in fate deck" });

          const card = target.zones.fateDeck.splice(j, 1)[0];
          if (!card) return ack?.({ ok: false, error: "deck splice failed" });

          // move back to fate discard
          target.zones.fateDiscard.push(card);

          last.undone = true;

          pushLog(io, roomId, {
            id: nanoid(8),
            ts: Date.now(),
            actorId: socket.id,
            type: "undo",
            data: { type: "undo", actionId: last.id }
          });

          emitRoomState(io, roomId);
          return ack?.({ ok: true });
      } else {
        return ack?.({ ok: false, error: "unsupported undo" });
      }

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "undo",
        data: { type: "undo", actionId: last.id },
      });

      ack?.({ ok: true });
    });
    socket.on("game:removeCard", (payload: {cardId: string; from: number}, ack?: (res: {ok: boolean; error?: string}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const from = Number(payload?.from);
      if (!(from >= 0 && from < 4)) return ack?.({ ok: false, error: "bad location index" });

      const fromLoc = me.board.locations[from];
      if (!fromLoc) return ack?.({ ok: false, error: "bad location" });
      const idx = fromLoc.bottom.findIndex(c => c.id === payload.cardId);
      if (idx === -1) return ack?.({ ok: false, error: "card not on that location (bottom)" });
      const cand = fromLoc.bottom[idx];
      if (cand?.locked) return ack?.({ ok: false, error: "card is locked" });
      const card = fromLoc.bottom.splice(idx, 1)[0]!;
      card.faceUp = true;
      me.zones.discard.push(card);

      ack?.({ ok: true });
      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "remove",
        data: { type: "remove", cardId: card.id, from: from as 0|1|2|3, fromIndex: idx },
      });
    });
    socket.on("game:reshuffleDeck", (ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const moved = shuffleDiscardIntoDeck(me);
      if (moved === 0) return ack?.({ ok: false, error: "discard is empty" });

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "reshuffle",
        data: { type: "reshuffle", moved },
      });

      ack?.({ ok: true });
    });
    socket.on("pile:takeFromDiscard", (payload: {cardId: string}, ack?: (res: { ok: boolean; error?: string}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // Only the active player can mutate, and only their own discard
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }
      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const id = (payload?.cardId || "").trim();
      if (!id) return ack?.({ ok: false, error: "missing cardId" });

      const fromIndex = me.zones.discard.findIndex(c => c.id === id);
      if (fromIndex === -1) return ack?.({ ok: false, error: "card not in your discard" });

      const card = me.zones.discard.splice(fromIndex, 1)[0]!;
      card.faceUp = true;                // known
      me.zones.hand.push(card);

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "retrieve",
        data: { type: "retrieve", cardId: card.id, fromIndex },
      });

      ack?.({ ok: true });
    });
    socket.on("power:change", (payload: { delta?: number } | undefined, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // self-only
      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const raw = Number(payload?.delta ?? 0);
      if (!Number.isFinite(raw) || raw === 0) return ack?.({ ok: false, error: "no change" });
      const clampedDelta = Math.max(-10, Math.min(10, Math.round(raw))); // small safety
      const prev = me.power ?? 0;
      const next = Math.max(0, Math.min(MAX_POWER, prev + clampedDelta));
      if (next === prev) return ack?.({ ok: false, error: "no change" });

      me.power = next;

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "power",
        data: { type: "power", delta: next - prev, prev, next },
      });

      ack?.({ ok: true });
    });
    socket.on("pawn:set", (payload: { to: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // self-only and (recommended) only on your turn
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const raw = Number(payload?.to);
      if (!Number.isInteger(raw) || raw < 0 || raw > 3) {
        return ack?.({ ok: false, error: "bad location index" });
      }
      const to = raw as 0|1|2|3;
      if (me.board.locations[to].locked) return ack?.({ ok: false, error: "location is locked" });

      const prev = me.board.moverAt;
      if (prev === to) return ack?.({ ok: false, error: "no change" });

      me.board.moverAt = to;

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "pawn",
        data: { type: "pawn", prev, next: to },
      });

      ack?.({ ok: true });
    });
    socket.on("board:toggleLocationLock", (payload: { index: number; locked?: boolean }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // self-only (lock your own board)
      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const raw = Number(payload?.index);
      if (!Number.isInteger(raw) || raw < 0 || raw > 3) return ack?.({ ok: false, error: "bad location index" });
      const locIdx = raw as 0|1|2|3;

      const loc = me.board.locations[locIdx];
      if (!loc) return ack?.({ ok: false, error: "bad location" });

      const prev = !!loc.locked;
      const next = typeof payload?.locked === "boolean" ? !!payload.locked : !prev;
      if (next === prev) return ack?.({ ok: false, error: "no change" });

      loc.locked = next;

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8), ts: Date.now(), actorId: socket.id, type: "lock",
        data: { type: "lock", target: "location", loc: locIdx, prev, next },
      });
      ack?.({ ok: true });
    });
    socket.on("board:toggleCardLock", (payload: { cardId: string; locked?: boolean }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // self-only (lock cards on your own board)
      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const id = (payload?.cardId || "").trim();
      if (!id) return ack?.({ ok: false, error: "missing cardId" });

      let locIdx: 0|1|2|3 | null = null;
      let row: "top" | "bottom" | null = null;
      let idx = -1;

      for (let i=0; i<4; i++) {
        const ii = i as 0 | 1 | 2 | 3;
        const loc = me.board.locations[ii];
        if (!loc) continue;
        const t = loc.top.findIndex(c => c.id === id);
        if (t !== -1) { locIdx = i as 0|1|2|3; row = "top"; idx = t; break; }
        const b = loc.bottom.findIndex(c => c.id === id);
        if (b !== -1) { locIdx = i as 0|1|2|3; row = "bottom"; idx = b; break; }
      }
      if (locIdx === null || row === null) return ack?.({ ok: false, error: "card not on your board" });

      const list = row === "top" ? me.board.locations[locIdx].top : me.board.locations[locIdx].bottom;
      const card = list[idx]!;
      const prev = !!card.locked;
      const next = typeof payload?.locked === "boolean" ? !!payload.locked : !prev;
      if (next === prev) return ack?.({ ok: false, error: "no change" });

      card.locked = next;

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8), ts: Date.now(), actorId: socket.id, type: "lock",
        data: { type: "lock", target: "card", loc: locIdx, row, cardId: id, prev, next },
      });
      ack?.({ ok: true });
    });
    socket.on("card:deltaStrength", (payload: {cardId?: string; delta?: number} | undefined, ack?: (res: {ok: boolean; error?: string}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // Self-only (adjust your own board), allowed any time during playing phase
      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const id = (payload?.cardId || "").trim();
      const raw = Number(payload?.delta);
      if (!id || !Number.isFinite(raw) || raw === 0) {
        return ack?.({ ok: false, error: "bad input" });
      }
      const delta = Math.max(-5, Math.min(5, Math.round(raw))); // small safety window

      // Find card on your board (top or bottom)
      let locIdx: 0|1|2|3 | null = null;
      let row: "top" | "bottom" | null = null;
      let idx = -1;

      for (let i = 0; i < 4; i++) {
        const ii = i as 0|1|2|3;
        const loc = me.board.locations[ii];
        if (!loc) continue;
        const t = loc.top.findIndex(c => c.id === id);
        if (t !== -1) { locIdx = ii; row = "top"; idx = t; break; }
        const b = loc.bottom.findIndex(c => c.id === id);
        if (b !== -1) { locIdx = ii; row = "bottom"; idx = b; break; }
      }
      if (locIdx === null || row === null) return ack?.({ ok: false, error: "card not on your board" });

      const list = row === "top" ? me.board.locations[locIdx]!.top : me.board.locations[locIdx]!.bottom;
      const card = list[idx]!;
      if (card.locked) return ack?.({ ok: false, error: "card is locked" });

      const prev = card.strength ?? 0;
      const next = Math.max(-20, Math.min(20, prev + delta)); // clamp
      if (next === prev) return ack?.({ ok: false, error: "no change" });

      card.strength = next;

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "strength",
        data: { type: "strength", cardId: card.id, loc: locIdx, row, prev, next, delta: next - prev },
      });
      ack?.({ ok: true });
    });
    socket.on("fate:reshuffleDeck", (payload: { playerId: string } | undefined, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      // Only the active player can trigger this (covers both fater and target on their turn)
      if (room.game.activePlayerId !== socket.id) {
        return ack?.({ ok: false, error: "not your turn" });
      }

      const pid = (payload?.playerId || "").trim();
      const target = room.players.find(p => p.id === pid);
      if (!target) return ack?.({ ok: false, error: "player not found" });

      const moved = shuffleFateDiscardIntoDeck(target);
      if (moved === 0) return ack?.({ ok: false, error: "fate discard is empty" });

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "fate_reshuffle",
        data: { type: "fate_reshuffle", targetId: target.id, moved },
      });

      ack?.({ ok: true });
    });
    socket.on("fate:start", (payload: { targetId: string } | undefined, ack?: (res: { ok: boolean; error?: string; cards?: Card[] }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) return ack?.({ ok: false, error: "not your turn" });
      if (room.fate) return ack?.({ ok: false, error: "fate already in progress" });

      const tid = (payload?.targetId || "").trim();
      const target = room.players.find(p => p.id === tid);
      if (!target) return ack?.({ ok: false, error: "target not found" });

      // allow fating yourself:
      const drawn = drawFromFate(target, 2); // may be 0, 1 or 2 depending on piles
      if (drawn.length === 0) return ack?.({ ok: false, error: "no fate cards available" });

      room.fate = { actorId: socket.id, targetId: target.id, drawn };

      // Broadcast counts changed (deck reduced), but not the cards
      emitRoomState(io, roomId);

      // Only the actor sees the actual drawn cards
      ack?.({ ok: true, cards: drawn });
    });
    socket.on("fate:cancel", (_: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (!room.fate || room.fate.actorId !== socket.id) return ack?.({ ok: false, error: "no active fate" });

      const sess = room.fate;
      const target = room.players.find(p => p.id === sess.targetId);
      if (!target) { delete room.fate; return ack?.({ ok: true }); }

      // Put drawn cards back on top (reverse to keep original top order)
      for (let i = sess.drawn.length - 1; i >= 0; i--) {
        const c = sess.drawn[i];
        if (c) target.zones.fateDeck.push(c);
      }
      delete room.fate;
      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });
    socket.on("fate:choosePlay", (payload: { cardId: string } | undefined, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (!room.fate || room.fate.actorId !== socket.id) return ack?.({ ok: false, error: "no active fate" });

      const sess = room.fate;
      const id = (payload?.cardId || "").trim();
      if (!id) return ack?.({ ok: false, error: "missing cardId" });
      if (!sess.drawn.some(c => c.id === id)) return ack?.({ ok: false, error: "card not in fate choices" });

      sess.chosenId = id;
      ack?.({ ok: true });
    });
    socket.on("fate:placeSelected", (payload: { locationIndex: number } | undefined, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      const sess = room.fate;
      if (!sess || sess.actorId !== socket.id) return ack?.({ ok: false, error: "no active fate" });

      const target = room.players.find(p => p.id === sess.targetId);
      if (!target) { delete room.fate; return ack?.({ ok: false, error: "target missing" }); }

      const raw = Number(payload?.locationIndex);
      if (!Number.isInteger(raw) || raw < 0 || raw > 3) return ack?.({ ok: false, error: "bad location index" });
      const i = raw as 0|1|2|3;

      const loc = target.board.locations[i];
      if (!loc) return ack?.({ ok: false, error: "bad location" });
      if (loc.locked) return ack?.({ ok: false, error: "location is locked" });

      const chosen = room.fate!.chosenId
        ? room.fate!.drawn.find(c => c && c.id === room.fate!.chosenId)
        : room.fate!.drawn[0];

      if (!chosen) return ack?.({ ok: false, error: "no chosen card" });
      const other = room.fate!.drawn.find(c => c && c.id !== chosen.id) || null;

      loc.top.push(chosen);
      if (other) target.zones.fateDiscard.push(other);

      delete room.fate;
      emitRoomState(io, roomId);

      const data = other
        ? { type: "fate_play" as const, targetId: target.id, playedCardId: chosen.id, locationIndex: i, discardedCardId: other.id }
        : { type: "fate_play" as const, targetId: target.id, playedCardId: chosen.id, locationIndex: i };
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "fate_play",
        data,
      });
      ack?.({ ok: true });
    });
    socket.on("fate:getDiscard", (payload: { playerId: string } | undefined, ack?: (res: { ok: boolean; error?: string; cards?: Card[] }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });

      const pid = (payload?.playerId || "").trim();
      const target = room.players.find(p => p.id === pid);
      if (!target) return ack?.({ ok: false, error: "player not found" });

      // top-first view
      const cards = target.zones.fateDiscard.slice().reverse();
      return ack?.({ ok: true, cards });
    });
    socket.on("fate:startFromDiscard", (payload: { targetId: string; cardId: string } | undefined, ack?: (res: { ok: boolean; error?: string; card?: Card }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) return ack?.({ ok: false, error: "not your turn" });
      if (room.fate) return ack?.({ ok: false, error: "fate already in progress" });

      const tid = (payload?.targetId || "").trim();
      const cid = (payload?.cardId || "").trim();
      if (!tid || !cid) return ack?.({ ok: false, error: "bad input" });

      const target = room.players.find(p => p.id === tid);
      if (!target) return ack?.({ ok: false, error: "target not found" });

      const idx = target.zones.fateDiscard.findIndex(c => c.id === cid);
      if (idx === -1) return ack?.({ ok: false, error: "card not in fate discard" });

      const [card] = target.zones.fateDiscard.splice(idx, 1);
      if (!card) return ack?.({ ok: false, error: "card missing" });

      // Create a single-card fate session, pre-chosen
      room.fate = {
        actorId: socket.id,
        targetId: target.id,
        drawn: [card],
        chosenId: card.id,
      };

      // Everyone sees counts change immediately
      emitRoomState(io, roomId);

      // Only the actor needs the actual card back (UI convenience)
      return ack?.({ ok: true, card });
    });
    socket.on("fate:discardBoth", (_: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (!room.fate || room.fate.actorId !== socket.id) {
        return ack?.({ ok: false, error: "no active fate" });
      }

      const sess = room.fate;
      const target = room.players.find(p => p.id === sess.targetId);
      if (!target) { delete room.fate; emitRoomState(io, roomId); return ack?.({ ok: true }); }

      if (sess.drawn.length < 2) {
        return ack?.({ ok: false, error: "need two fate cards to discard both" });
      }

      // Move both drawn cards into fate discard (face-up)
      const ids: string[] = [];
      for (const c of sess.drawn) {
        c.faceUp = true;
        target.zones.fateDiscard.push(c);
        ids.push(c.id);
      }

      // log
      room.log.push({
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "fate_discard_both",
        data: { type: "fate_discard_both", targetId: target.id, cardIds: ids },
      });

      delete room.fate;
      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });
    socket.on("board:moveTop", (payload: {cardId?: string; from?: number; to?: number} | undefined, ack?: (res: {ok: boolean; error?: string}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) return ack?.({ ok: false, error: "not your turn" });

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const cardId = (payload?.cardId || "").trim();
      const from = Number(payload?.from);
      const to   = Number(payload?.to);
      if (!cardId || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from > 3 || to < 0 || to > 3) {
        return ack?.({ ok: false, error: "bad input" });
      }

      const fromLoc = me.board.locations[from];
      const toLoc   = me.board.locations[to];
      if (!fromLoc || !toLoc) return ack?.({ ok: false, error: "bad location" });
      if (toLoc.locked) return ack?.({ ok: false, error: "destination locked" });

      const j = fromLoc.top.findIndex(c => c.id === cardId);
      if (j === -1) return ack?.({ ok: false, error: "card not in top at source" });
      const [card] = fromLoc.top.splice(j, 1);
      if (!card) return ack?.({ ok: false, error: "card missing" });

      const destIndex = toLoc.top.length;
      toLoc.top.push(card);

      emitRoomState(io, roomId);

      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "move_top",
        data: { type: "move_top", cardId, from: from as 0|1|2|3, to: to as 0|1|2|3, fromIndex: j, toIndex: toLoc.top.length - 1 },
      });

      ack?.({ ok: true });
    })
    socket.on("board:discardTop", (payload: {locationIndex?: number; cardId?: string} | undefined, ack?: (res: {ok: boolean; error?: string}) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) return ack?.({ ok: false, error: "not your turn" });

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const iRaw = Number(payload?.locationIndex);
      const cardId = (payload?.cardId || "").trim();
      if (!Number.isInteger(iRaw) || iRaw < 0 || iRaw > 3) return ack?.({ ok: false, error: "bad location index" });
      if (!cardId) return ack?.({ ok: false, error: "missing cardId" });

      const i = iRaw as 0|1|2|3;
      const loc = me.board.locations[i];
      if (!loc) return ack?.({ ok: false, error: "bad location" });
      if (loc.locked) return ack?.({ ok: false, error: "location is locked" });

      const j = loc.top.findIndex(c => c.id === cardId);
      if (j === -1) return ack?.({ ok: false, error: "card not in top at that location" });

      const [card] = loc.top.splice(j, 1);
      if (!card) return ack?.({ ok: false, error: "card missing" });

      // Top → fateDiscard
      me.zones.fateDiscard.push(card);

      emitRoomState(io, roomId);
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "fate_discard_top",
        data: { type: "fate_discard_top", cardId, locationIndex: i },
      });

      ack?.({ ok: true });
    })
    socket.on("game:claimWin", (_: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      me.won = true;

      const msg: ChatMsg = {
        id: nanoid(8),
        ts: Date.now(),
        playerId: me.id,
        name: me.name,
        text: `${me.name} has claimed victory! 🏆`,
      };
      room.messages.push(msg);

      if (room.messages.length > 100) room.messages = room.messages.slice(-100);
      io.to(roomId).emit("chat:msg", { roomId, msg });

      if (room.game.activePlayerId === me.id) {
        const { wrapped } = advanceToNextActive(room);
        if (wrapped) room.game.turn += 1;
      }

      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });
    socket.on("meta:getCharacters", (_: unknown, ack?: (res: { ok: boolean; error?: string; characters?: CharacterPreview[] }) => void) => {
      const characters = Object.values(CHARACTERS).map(c => ({
        id: c.id,
        name: c.name,
        locations: c.locations,
      }));
      ack?.({ ok: true, characters });
    });
    socket.on("game:playEffect", (payload: { cardId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) return ack?.({ ok: false, error: "not your turn" });

      const me = room.players.find(p => p.id === socket.id);
      if (!me) return ack?.({ ok: false, error: "player not found" });

      const cardId = (payload?.cardId ?? "").trim();
      if (!cardId) return ack?.({ ok: false, error: "no card specified" });

      const card = me.zones.hand.find(c => c.id === cardId);
      if (!card) return ack?.({ ok: false, error: "card not in hand" });

      if (card.type !== "Effect" && card.type !== "Condition") {
        return ack?.({ ok: false, error: "only effects/conditions can be played this way" });
      }

      const idx = me.zones.hand.findIndex(c => c.id === cardId);
      if (idx < 0) return ack?.({ ok: false, error: "card not in hand" });
      const removed = me.zones.hand.splice(idx, 1);
      const taken = removed[0];
      if (!taken) return ack?.({ ok: false, error: "failed to remove card" });

      taken.faceUp = true;
      me.zones.discard.push(taken);   // taken is Card, not undefined

      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: me.id,
        type: "play_effect",
        data: { type: "play_effect", cardId: taken.id },
      });

      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });
    socket.on("fatePeek:start", (payload: { targetId: string; count: number }, ack?: (res: { ok: boolean; error?: string; cards?: Card[]; targetName?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });
      if (room.game.activePlayerId !== socket.id) return ack?.({ ok: false, error: "not your turn" });

      if (room.fatePeek && room.fatePeek.actorId !== socket.id) {
        return ack?.({ ok: false, error: "another peek is active" });
      }

      const pid = (payload?.targetId || "").trim();
      const target = room.players.find(p => p.id === pid);
      if (!target) return ack?.({ ok: false, error: "target not found" });

      const n = Math.max(1, Math.min(Number(payload?.count ?? 2), 5)); // clamp 1..5
      const drawn: Card[] = [];
      for (let i = 0; i < n; i++) {
        const c = target.zones.fateDeck.pop();
        if (!c) break;
        drawn.push(c); // drawn[0] is the original top
      }

      room.fatePeek = { actorId: socket.id, targetId: pid, drawn };
      ack?.({
        ok: true,
        cards: drawn,
        targetName: target.name
      });
    });
    socket.on("fatePeek:confirm", (payload: { orderIds: string[] }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      const sess = room.fatePeek;
      if (!sess || sess.actorId !== socket.id) return ack?.({ ok: false, error: "no active peek" });

      const target = room.players.find(p => p.id === sess.targetId);
      if (!target) { delete room.fatePeek; return ack?.({ ok: true }); }

      const byId = new Map(sess.drawn.map(c => [c.id, c] as const));
      const ordered = (payload?.orderIds ?? [])
        .map(id => byId.get(id))
        .filter((c): c is Card => !!c);

      if (ordered.length !== sess.drawn.length) {
        return ack?.({ ok: false, error: "invalid order set" });
      }

      for (const card of ordered.slice().reverse()) {
        target.zones.fateDeck.push(card);
      }

      pushLog(io, roomId, {
        id: nowId(),
        ts: Date.now(),
        actorId: socket.id,
        type: "fate_peek",
        data: { type: "fate_peek", targetId: target.id, count: ordered.length }
      });

      delete room.fatePeek;
      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });
    socket.on("fatePeek:cancel", (_: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });

      const sess = room.fatePeek;
      if (!sess || sess.actorId !== socket.id) return ack?.({ ok: false, error: "no active peek" });

      const target = room.players.find(p => p.id === sess.targetId);
      if (target) {
        for (const c of [...sess.drawn].reverse()) {
          target.zones.fateDeck.push(c);
        }
      }
      delete room.fatePeek;
      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });
    socket.on("fateDiscard:return", (payload: { playerId: string; cardId: string }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      const roomId = socket.data.roomId as string | null;
      if (!roomId) return ack?.({ ok: false, error: "not in a room" });
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "room not found" });
      if (room.game.phase !== "playing") return ack?.({ ok: false, error: "game not started" });

      const targetId = (payload?.playerId || "").trim();
      const cardId = (payload?.cardId || "").trim();
      if (!targetId || !cardId) return ack?.({ ok: false, error: "bad request" });

      const target = room.players.find(p => p.id === targetId);
      if (!target) return ack?.({ ok: false, error: "player not found" });

      const idx = target.zones.fateDiscard.findIndex(c => c.id === cardId);
      if (idx < 0) return ack?.({ ok: false, error: "card not in fate discard" });

      const [card] = target.zones.fateDiscard.splice(idx, 1);
      if (!card) return ack?.({ ok: false, error: "splice failed" });
      target.zones.fateDeck.push(card);

      // reshuffle the fate deck
      shuffle(target.zones.fateDeck);

      // log
      pushLog(io, roomId, {
        id: nanoid(8),
        ts: Date.now(),
        actorId: socket.id,
        type: "fate_return",
        data: { type: "fate_return", targetId, cardId },
      });

      emitRoomState(io, roomId);
      ack?.({ ok: true });
    });



});

console.log(`Socket.io server listening on ws://localhost:${PORT}`);