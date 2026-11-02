import { nanoid } from "nanoid";
import type { LogItem } from "../protocol";
import type { ActionData, ActionEntry, ActionOf, ActionType, Player, Room } from "../types";
import { isUndoable } from "./undo";

const MAX_LOG = 25;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;

type Formatters = {[T in ActionType]: (who: string, data: ActionOf<T>, nameOf: (id: string) => string) => string};

//these reach every player, so they must never name a hidden card
const FORMAT: Formatters = {
  draw: (who, d) => `${who} drew ${plural(d.cardIds.length, "card")}`,
  play: (who, d) => `${who} played a card to L${d.locationIndex + 1}`,
  discard: (who, d) => `${who} discarded ${plural(d.cardIds.length, "card")}`,
  undo: (who) => `${who} undid their last action`,
  move: (who, d) => `${who} moved a card L${d.from + 1} → L${d.to + 1}`,
  remove: (who, d) => `${who} discarded a board card from L${d.from + 1}`,
  reshuffle: (who, d) => `${who} reshuffled ${plural(d.moved, "card")} into deck`,
  retrieve: (who) => `${who} took a card from discard`,
  power: (who, d) => `${who} ${signed(d.delta)} power (${d.prev} → ${d.next})`,
  pawn: (who, d) => `${who} moved pawn to L${d.next + 1}`,
  lock: (who, d) => {
    const verb = d.next ? "locked" : "unlocked";
    return d.target === "location" ? `${who} ${verb} L${d.loc + 1}` : `${who} ${verb} a card on L${d.loc + 1}`;
  },
  strength: (who, d) => `${who} ${signed(d.delta)} strength on L${d.loc + 1} (now ${d.next >= 0 ? "+" : ""}${d.next})`,
  fate_reshuffle: (who, d, nameOf) => `${who} reshuffled ${plural(d.moved, "fate card")} for ${nameOf(d.targetId)}`,
  fate_play: (who, d, nameOf) => `${who} fated ${nameOf(d.targetId)}: played a fate card to L${d.locationIndex + 1}${d.discardedOther ? " (discarded another)" : ""}`,
  move_top: (who, d) => `${who} moved a top card from L${d.from + 1} to L${d.to + 1}`,
  fate_discard_top: (who, d) => `${who} discarded a top card from L${d.locationIndex + 1}`,
  fate_discard_both: (who, d, nameOf) => `${who} discarded both fate cards for ${nameOf(d.targetId)}.`,
  fate_discard_one: (who, d, nameOf) => `${who} discarded ${d.label} from ${nameOf(d.targetId)}'s fate reveal.`,
  play_effect: (who, d) => `${who} played ${d.label} (effect)`,
  fate_peek: (who, d, nameOf) => `${who} arranged the top ${d.count} cards of ${nameOf(d.targetId)}'s fate deck`,
  fate_return: (who, d, nameOf) => `${who} returned a fate card to ${nameOf(d.targetId)}'s deck and reshuffled`,
  reveal_hand: (who, d) => `${who} ${d.next ? "revealed" : "hid"} their hand`,
  fate_sift: (who, d, nameOf) => `${who} sifted fate for ${nameOf(d.targetId)}: discarded ${d.discardedLabel}${d.keptOnTop ? ", kept the other on top" : ""}`,
  trust: (who, d) => `${who} Trust ${signed(d.delta)} (${d.prev} → ${d.next})`,
  char_flip_buzz: (who, d) => `${who} flipped ${d.fromLabel} → ${d.toLabel} at L${d.loc + 1}`,
  fate_find_hero: (who, d, nameOf) =>
    `${who} revealed from ${nameOf(d.targetId)}'s fate deck until a Hero (${plural(d.revealed, "card")}) — ${d.heroLabel ? `found ${d.heroLabel}` : "no Hero found"}`,
};

function formatEntry(room: Room, entry: ActionEntry): string {
  const nameOf = (id: string) => room.players.find(p => p.id === id)?.name ?? "a player";
  const format = FORMAT[entry.data.type] as (who: string, data: ActionData, nameOf: (id: string) => string) => string;
  return format(entry.actorName, entry.data, nameOf);
}

//most recent first
export function buildLogItems(room: Room): LogItem[] {
  return room.log.map((e) => ({
    id: e.id,
    ts: e.ts,
    actorId: e.actorId,
    actorName: e.actorName,
    type: e.data.type,
    text: formatEntry(room, e),
    undoable: isUndoable(e.data.type),
  })).reverse();
}

export function appendLog(room: Room, actor: Player, data: ActionData) {
  room.log.push({id: nanoid(8), ts: Date.now(), actorId: actor.id, actorName: actor.name, data});
  if (room.log.length > MAX_LOG) room.log.splice(0, room.log.length - MAX_LOG);
}
