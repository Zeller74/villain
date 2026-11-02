import { nanoid } from "nanoid";
import type { Card } from "../protocol";
import type { CardTemplate, Player } from "../types";

export function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

export function expandDeck(templates: CardTemplate[]): Card[] {
  const out: Card[] = [];
  for (const t of templates) {
    for (let i = 0; i < (t.copies ?? 1); i++) {
      out.push({
        id: nanoid(8),
        label: t.label,
        type: t.type,
        desc: t.description ?? "",
        cost: t.cost ?? null,
        baseStrength: t.strength ?? null,
        strength: 0,
        locked: false,
        ...(t.ignoresLock ? {ignoresLock: true} : {}),
      });
    }
  }
  return out;
}

//removes a card from a pile and returns it, or undefined if it is not there
export function take(pile: Card[], cardId: string): Card | undefined {
  const i = pile.findIndex(c => c.id === cardId);
  return i === -1 ? undefined : pile.splice(i, 1)[0];
}

//counters and locks belong to the card's time in play, not to the card
export function clearInPlayState(card: Card) {
  card.strength = 0;
  card.locked = false;
}

export function isHero(c: Card) {
  return c.type === "Hero";
}

export function makeBuzz(): Card {
  return {
    id: nanoid(8),
    label: "Buzz Lightyear",
    cost: null,
    baseStrength: null,
    strength: 0,
    locked: false,
    type: "Guardian",
    desc: "Neither Buzz Lightyear nor any Heroes in his location can be targeted by Vanquish actions.",
  };
}

export function makeDemoBuzz(): Card {
  return {
    id: nanoid(8),
    label: "Demo Mode Buzz Lightyear",
    cost: null,
    baseStrength: 1,
    strength: 0,
    locked: false,
    type: "Ally",
    desc: "Demo Mode Buzz Lightyear can only be used in a Vanquish action with at least one other Ally. Demo Mode Buzz Lightyear is not discarded when used to defeat a Hero. Heroes defeated in a Vanquish action using Demo Mode Buzz Lightyear are moved to the Caterpillar Room.",
  };
}

export function reshuffleFromDiscardIntoDeck(p: Player): boolean {
  if (p.zones.deck.length > 0 || p.zones.discard.length === 0) return false;
  p.zones.deck = p.zones.discard.splice(0);
  shuffle(p.zones.deck);
  return true;
}

export function shuffleDiscardIntoDeck(p: Player): number {
  const moved = p.zones.discard.length;
  if (moved === 0) return 0;
  p.zones.deck.push(...p.zones.discard.splice(0));
  shuffle(p.zones.deck);
  return moved;
}

export function shuffleFateDiscardIntoDeck(p: Player): number {
  const moved = p.zones.fateDiscard.length;
  if (moved === 0) return 0;
  p.zones.fateDeck.push(...p.zones.fateDiscard.splice(0));
  shuffle(p.zones.fateDeck);
  return moved;
}

//draws what is left first, so a reshuffle never disturbs a top card someone arranged
export function drawFromFate(p: Player, n: number): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (p.zones.fateDeck.length === 0) shuffleFateDiscardIntoDeck(p);
    const card = p.zones.fateDeck.pop();
    if (!card) break;
    out.push(card);
  }
  return out;
}

export function findOnBoard(p: Player, cardId: string) {
  for (const [i, loc] of p.board.locations.entries()) {
    for (const row of [loc.top, loc.bottom]) {
      const card = row.find(c => c.id === cardId);
      if (card) return {card, loc: i as 0 | 1 | 2 | 3};
    }
  }
  return null;
}
