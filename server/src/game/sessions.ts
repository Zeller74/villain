import type { Player, Room, Session } from "../types";
import { fail } from "./errors";

export function assertNoSession(room: Room) {
  if (room.session) fail("a fate action is already in progress");
}

export function mySession<K extends Session["kind"]>(room: Room, me: Player, kind: K) {
  const session = room.session;
  if (!session || session.kind !== kind || session.actorId !== me.id) fail(`no active ${kind}`);
  return session as Extract<Session, {kind: K}>;
}

//abandons the open action and puts its cards back exactly where they came from
export function cancelSession(room: Room) {
  const session = room.session;
  if (!session) return;
  delete room.session;

  const target = room.players.find(p => p.id === session.targetId);
  if (!target) return;

  if (session.kind === "fate" && session.source === "discard") {
    target.zones.fateDiscard.push(...session.drawn);
    return;
  }
  //drawn[0] was the top card, so it has to go back last
  for (const card of [...session.drawn].reverse()) target.zones.fateDeck.push(card);
}

//called before a player leaves for good, so nothing is stranded in their session
export function releaseSessionsOf(room: Room, player: Player) {
  const session = room.session;
  if (!session) return;
  if (session.actorId === player.id) cancelSession(room);
  //the cards belong to the target, so they leave with them
  else if (session.targetId === player.id) delete room.session;
}
