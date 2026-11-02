import type { Seat } from "./protocol";

const KEY = "villain.seat";

//sessionStorage keeps two tabs on one computer as separate players; localStorage is the
//fallback for a closed tab or a phone browser that discarded it. Either may be unavailable,
//so reading never throws
function read(storage: Storage): Seat | null {
  try {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

//ownTab says this tab held the seat. Otherwise it may belong to another tab that is still open
export function loadSeat(): {seat: Seat; ownTab: boolean} | null {
  const own = read(sessionStorage);
  if (own) return {seat: own, ownTab: true};
  const last = read(localStorage);
  return last ? {seat: last, ownTab: false} : null;
}

export function saveSeat(seat: Seat) {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.setItem(KEY, JSON.stringify(seat));
    } catch {
      //private windows can refuse storage. The game still works, just without resuming
    }
  }
}

export function clearSeat() {
  for (const storage of [sessionStorage, localStorage]) {
    try {
      storage.removeItem(KEY);
    } catch {
      //nothing was stored if storage is unavailable
    }
  }
}
