import type { Seat } from "./protocol";

const TAB_KEY = "villain.seat";
const BROWSER_KEY = "villain.seats";
const MAX_SAVED = 10;

//sessionStorage holds this tab's own seat, and comes back when a closed tab is restored.
//localStorage holds every seat this browser has, so a new tab can pick up one whose tab
//was closed. Either may be unavailable, so nothing here throws
function read<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    //private windows can refuse storage. The game still works, just without resuming
  }
}

function remove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    //nothing was stored if storage is unavailable
  }
}

export function loadTabSeat(): Seat | null {
  return read<Seat>(sessionStorage, TAB_KEY);
}

//newest first
export function loadBrowserSeats(): Seat[] {
  const seats = read<Seat[]>(localStorage, BROWSER_KEY);
  return Array.isArray(seats) ? seats : [];
}

export function saveSeat(seat: Seat) {
  write(sessionStorage, TAB_KEY, seat);
  const others = loadBrowserSeats().filter(s => s.token !== seat.token);
  write(localStorage, BROWSER_KEY, [seat, ...others].slice(0, MAX_SAVED));
}

//this tab no longer holds its seat, but the seat still exists
export function releaseTabSeat() {
  remove(sessionStorage, TAB_KEY);
}

//the seat is gone for good
export function forgetSeat(seat: Seat) {
  if (loadTabSeat()?.token === seat.token) releaseTabSeat();
  write(localStorage, BROWSER_KEY, loadBrowserSeats().filter(s => s.token !== seat.token));
}
