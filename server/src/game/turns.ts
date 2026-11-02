import type { Player, Room } from "../types";
import { cancelSession } from "./sessions";

function advanceToNextActive(room: Room): {wrapped: boolean} {
  const players = room.players;
  const curIdx = players.findIndex(p => p.id === room.game.activePlayerId);

  for (let step = 1; step <= players.length; step++) {
    const idx = (curIdx + step) % players.length;
    const p = players[idx];
    if (p && !p.won) {
      room.game.activePlayerId = p.id;
      return {wrapped: curIdx >= 0 && idx <= curIdx};
    }
  }

  room.game.activePlayerId = null;
  return {wrapped: false};
}

export function passTurn(room: Room) {
  const {wrapped} = advanceToNextActive(room);
  if (wrapped) room.game.turn += 1;
  for (const p of room.players) p.reacting = false;
}

//the active player, or someone resolving a Condition on another player's turn
export function canAct(room: Room, player: Player) {
  return room.game.activePlayerId === player.id || player.reacting;
}

//the game is over once someone has won and at most one player is still going
export function endGameIfDecided(room: Room) {
  if (room.game.phase !== "playing") return;
  const someoneWon = room.players.some(p => p.won);
  const stillPlaying = room.players.filter(p => !p.won).length;
  if (!someoneWon || stillPlaying > 1) return;
  cancelSession(room);
  room.game.phase = "ended";
  room.game.activePlayerId = null;
}
