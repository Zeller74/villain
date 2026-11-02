import { nanoid } from "nanoid";
import { getCharacter } from "../data/characters";
import type { Board, Location } from "../protocol";
import type { LocationTemplate, Player, Zones } from "../types";
import { expandDeck, makeBuzz, shuffle, take } from "./cards";

export function emptyZones(): Zones {
  return {deck: [], hand: [], discard: [], fateDeck: [], fateDiscard: []};
}

function makeLocation(id: string, name: string, template?: LocationTemplate): Location {
  return {
    id,
    name,
    locked: false,
    actions: template?.actions ?? [],
    topSlots: template?.topSlots ?? Math.min(2, template?.actions.length ?? 0),
    top: [],
    bottom: [],
  };
}

export function makeEmptyBoard(): Board {
  return {
    moverAt: 0,
    locations: [0, 1, 2, 3].map(i => makeLocation(nanoid(6), `Loc ${i + 1}`)) as Board["locations"],
  };
}

function makeBoardFrom(templates: LocationTemplate[]): Board {
  const mk = (i: number) => {
    const t = templates[i];
    return makeLocation(`L${i + 1}`, t?.name ?? `Location ${i + 1}`, t);
  };
  return {moverAt: 0, locations: [mk(0), mk(1), mk(2), mk(3)]};
}

//villains that start with something already in their Realm
const SPECIAL_SETUP: Record<string, (p: Player) => void> = {
  mother: (p) => {
    const rapunzel = p.zones.fateDeck.find(c => /rapunzel/i.test(c.label));
    if (rapunzel) p.board.locations[0].top.push(take(p.zones.fateDeck, rapunzel.id)!);
  },
  lotso: (p) => {
    p.board.locations[0].top.push(makeBuzz());
  },
};

export function setupPlayerForGame(p: Player) {
  const character = getCharacter(p.characterId);
  p.board = makeBoardFrom(character.locations);
  p.zones = {...emptyZones(), deck: expandDeck(character.deck), fateDeck: expandDeck(character.fateDeck)};
  p.power = 0;
  p.trust = 0;
  p.won = false;
  p.handPublic = false;
  p.reacting = false;
  shuffle(p.zones.deck);
  shuffle(p.zones.fateDeck);
  SPECIAL_SETUP[p.characterId]?.(p);
}

export function resetPlayerForLobby(p: Player) {
  p.board = makeEmptyBoard();
  p.zones = emptyZones();
  p.ready = false;
  p.power = 0;
  p.trust = 0;
  p.won = false;
  p.handPublic = false;
  p.reacting = false;
}
