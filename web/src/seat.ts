import type { Seat } from "./protocol";

const KEY = "villain.seat";

//sessionStorage keeps two tabs on one computer as separate players; localStorage is the
//fallback for a closed tab or a phone browser that discarded it. Either may be unavailable
function read(storage: Storage): Seat | null {
  try {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Seat) : null;
  } catch {
    return null;
  }
}

export function loadSeat(): Seat | null {
  return read(sessionStorage) ?? read(localStorage);
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
