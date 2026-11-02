import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Card, Location, Pending, PublicPlayer, RoomState } from "./protocol";
import { FakeSocket } from "./test/fakeSocket";

const holder = vi.hoisted(() => ({socket: null as unknown}));
vi.mock("./socket", () => ({makeSocket: () => holder.socket}));

const ME = "me";
const THEM = "them";
const SEAT = {roomId: "room1", playerId: ME, token: "secret"};

let socket: FakeSocket;

const card = (id: string, over: Partial<Card> = {}): Card => ({
  id, label: id, type: "Ally", desc: "", cost: 2, baseStrength: 2, strength: 0, locked: false, ...over,
});

const location = (i: number, over: Partial<Location> = {}): Location => ({
  id: `L${i + 1}`, name: `Place ${i + 1}`, locked: false, actions: [], topSlots: 2, top: [], bottom: [], ...over,
});

const player = (id: string, over: Partial<PublicPlayer> = {}): PublicPlayer => ({
  id, name: id, ready: true, connected: true, characterId: "captain", won: false, reacting: false, power: 0, trust: 0,
  counts: {deck: 30, hand: 0, discard: 0, fateDeck: 15, fateDiscard: 0},
  discardTop: null, handPublic: false, publicHand: null,
  board: {moverAt: 0, locations: [location(0), location(1), location(2), location(3)]},
  ...over,
});

const state = (me: Partial<PublicPlayer> = {}, game: Partial<RoomState["game"]> = {}, them: Partial<PublicPlayer> = {}): RoomState => ({
  roomId: "room1",
  ownerId: ME,
  players: [player(ME, me), player(THEM, them)],
  game: {phase: "playing", turn: 1, activePlayerId: ME, ...game},
});

function boardWith(cards: Card[], at = 0) {
  return {moverAt: 0 as const, locations: [location(0), location(1), location(2), location(3)].map((l, i) => i === at ? {...l, bottom: cards} : l) as PublicPlayer["board"]["locations"]};
}

//renders the app and walks it back into a game through the normal resume path
function enterGame(room: RoomState, hand: Card[] = [], pending: Pending | null = null) {
  sessionStorage.setItem("villain.seat", JSON.stringify(SEAT));
  render(<App />);
  socket.receive("connect");
  socket.reply("meta:getCharacters", {ok: true, characters: [{id: "captain", name: "Captain Hook", locations: []}, {id: "prince", name: "Prince John", locations: []}]});
  socket.reply("room:resume", {ok: true, ...SEAT});
  socket.receive("room:state", room);
  socket.receive("room:self", {roomId: "room1", hand, pending});
}

const handCard = (label: string) => within(screen.getByText("Your hand").parentElement!.parentElement!.nextElementSibling as HTMLElement).getByText(label);
const boardCard = (label: string, at = 0) => within(screen.getByTestId(`bottom-${at}`)).getByText(label);
const moveBanner = () => screen.queryByText(/click a location to drop/);
const toast = () => screen.queryByRole("alert")?.textContent ?? null;

beforeEach(() => {
  socket = new FakeSocket();
  holder.socket = socket;
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("clicking cards on the board", () => {
  it("starts a move without complaining about the hand", () => {
    enterGame(state({board: boardWith([card("Smee")])}));
    fireEvent.click(boardCard("Smee"));
    expect(moveBanner()).not.toBeNull();
    expect(toast()).toBeNull();
  });

  it("does not also play a selected hand card", () => {
    enterGame(state({board: boardWith([card("Smee")])}), [card("Cannon")]);
    fireEvent.click(handCard("Cannon"));
    fireEvent.click(boardCard("Smee"));
    expect(socket.sentOf("game:playToLocation")).toHaveLength(0);
    expect(moveBanner()).not.toBeNull();
  });

  it("still plays a selected card when the empty part of a location is clicked", () => {
    enterGame(state(), [card("Cannon")]);
    fireEvent.click(handCard("Cannon"));
    fireEvent.click(screen.getByTestId("bottom-2"));
    expect(socket.sentOf("game:playToLocation")[0]!.payload).toEqual({cardId: "Cannon", locationIndex: 2});
  });

  it("drops a moving card when another location's card is clicked", () => {
    const board = {moverAt: 0 as const, locations: [location(0, {bottom: [card("Smee")]}), location(1, {bottom: [card("Starkey")]}), location(2), location(3)] as PublicPlayer["board"]["locations"]};
    enterGame(state({board}));
    fireEvent.click(boardCard("Smee"));
    fireEvent.click(boardCard("Starkey", 1));
    expect(socket.sentOf("game:moveCard")[0]!.payload).toEqual({cardId: "Smee", from: 0, to: 1});
  });

  it("cancels the move when the same card is clicked again", () => {
    enterGame(state({board: boardWith([card("Smee")])}));
    fireEvent.click(boardCard("Smee"));
    fireEvent.click(boardCard("Smee"));
    expect(moveBanner()).toBeNull();
    expect(socket.sentOf("game:moveCard")).toHaveLength(0);
  });

  it("ignores clicks on the board when it is not your turn", () => {
    enterGame(state({board: boardWith([card("Smee")])}, {activePlayerId: THEM}));
    fireEvent.click(boardCard("Smee"));
    expect(moveBanner()).toBeNull();
  });
});

describe("taking from the discard", () => {
  it("sends the request exactly once", () => {
    const discarded = card("Smee");
    enterGame(state({discardTop: discarded, counts: {deck: 29, hand: 0, discard: 1, fateDeck: 15, fateDiscard: 0}}));
    fireEvent.click(within(screen.getByText("Your discard").parentElement!).getByText("Open Discard"));
    socket.reply("pile:getDiscard", {ok: true, cards: [discarded]});

    fireEvent.click(within(screen.getByRole("dialog")).getByText("Smee"));

    expect(socket.sentOf("pile:takeFromDiscard")).toHaveLength(1);
  });
});

describe("Condition cards", () => {
  it("can be played on another player's turn", () => {
    enterGame(state({}, {activePlayerId: THEM}), [card("Greed", {type: "Condition"})]);
    fireEvent.click(handCard("Greed"));
    const play = screen.getByText("Play Effect") as HTMLButtonElement;
    expect(play.disabled).toBe(false);
    fireEvent.click(play);
    expect(socket.sentOf("game:playEffect")).toHaveLength(1);
  });

  it("does not extend to Effect cards", () => {
    enterGame(state({}, {activePlayerId: THEM}), [card("Vanish", {type: "Effect"})]);
    fireEvent.click(handCard("Vanish"));
    expect((screen.getByText("Play Effect") as HTMLButtonElement).disabled).toBe(true);
  });

  it("lets a reacting player act until they click Done", () => {
    enterGame(state({reacting: true}, {activePlayerId: THEM}));
    expect((screen.getByText("Draw 1") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText("Done"));
    expect(socket.sentOf("reaction:end")).toHaveLength(1);
  });
});

describe("what the board shows", () => {
  it("shows strength counters to other players", () => {
    enterGame(state({}, {}, {board: boardWith([card("Smee", {strength: 2})])}));
    fireEvent.click(screen.getByText("them"));
    expect(screen.getByTitle("Current strength").textContent).toBe("+2");
  });

  it("hides the cost of cards that have none", () => {
    enterGame(state({board: boardWith([card("Greed", {cost: null})])}));
    expect(screen.queryByTitle("Cost")).toBeNull();
  });

  it("marks disconnected players", () => {
    enterGame(state({}, {}, {connected: false}));
    expect(screen.getByText("them (offline)")).toBeTruthy();
  });

  it("offers Undo only for actions that can be undone", () => {
    enterGame(state());
    const item = {id: "1", ts: 0, actorId: ME, actorName: ME, type: "draw", text: "drew", undoable: true};

    socket.receive("room:log", {items: [item]});
    expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(false);

    socket.receive("room:log", {items: [{...item, undoable: false}]});
    expect((screen.getByText("Undo") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the character menu", () => {
  it("says so when a villain has no actions", () => {
    enterGame(state({characterId: "prince"}));
    fireEvent.click(screen.getByLabelText("Character actions"));
    expect(screen.getByText("(No actions available)")).toBeTruthy();
  });

  it("closes as soon as an action is chosen, so it cannot be double-clicked", () => {
    enterGame(state());
    fireEvent.click(screen.getByLabelText("Character actions"));
    fireEvent.click(screen.getByText("Give Them a Scare"));
    expect(screen.queryByText("Give Them a Scare")).toBeNull();
    expect(socket.sentOf("fatePeek:start")).toHaveLength(1);
  });
});

describe("fate", () => {
  const twoCards = [card("Tinker Bell", {type: "Hero"}), card("Mermaid", {type: "Hero"})];
  const fate: Pending = {kind: "fate", targetId: THEM, targetName: THEM, cards: twoCards, chosenId: null};

  it("restores an open fate from the server, on the target's board", () => {
    enterGame(state(), [], fate);
    expect(screen.getByText("Fate: choose a card to play")).toBeTruthy();
    expect(screen.getByText("them's hand")).toBeTruthy();
  });

  it("can be cancelled while placing, which the old banner could not do", () => {
    enterGame(state(), [], {...fate, chosenId: "Mermaid"});
    fireEvent.click(screen.getByText("Cancel"));
    expect(socket.sentOf("fate:cancel")).toHaveLength(1);
  });

  it("leaves the decision about a locked location to the server", () => {
    const board = {moverAt: 0 as const, locations: [location(0), location(1), location(2), location(3, {locked: true})] as PublicPlayer["board"]["locations"]};
    enterGame(state({}, {}, {board}), [], {...fate, chosenId: "Mermaid"});
    fireEvent.click(screen.getByTestId("top-3"));
    expect(socket.sentOf("fate:placeSelected")[0]!.payload).toEqual({locationIndex: 3});
  });

  it("sends a peek back in the order it was arranged", () => {
    enterGame(state(), [], {kind: "peek", targetId: ME, targetName: ME, cards: twoCards});
    fireEvent.click(screen.getAllByTitle("Move toward bottom (right)")[0]!);
    fireEvent.click(screen.getByText("Confirm Order"));
    expect(socket.sentOf("fatePeek:confirm")[0]!.payload).toEqual({orderIds: ["Mermaid", "Tinker Bell"]});
  });

  it("only offers fate discard actions to a player who can use them", () => {
    enterGame(state({}, {activePlayerId: THEM}));
    fireEvent.click(screen.getAllByText("Open Discard")[0]!);
    socket.reply("fate:getDiscard", {ok: true, cards: [card("Mermaid")]});
    expect(screen.queryByText("Return to Deck")).toBeNull();
  });
});

describe("losing the connection", () => {
  it("keeps the game on screen and says a seat is being held", () => {
    enterGame(state());
    socket.receive("disconnect", "transport close");
    expect(screen.getByText("End Turn")).toBeTruthy();
    expect(screen.getByText(/your seat is being held/)).toBeTruthy();
  });

  it("resumes on every reconnect", () => {
    enterGame(state());
    socket.receive("disconnect", "transport close");
    socket.receive("connect");
    expect(socket.sentOf("room:resume")).toHaveLength(2);
    expect(socket.sentOf("room:resume")[1]!.payload).toEqual({roomId: "room1", token: "secret"});
  });

  it("returns home with an explanation if the game is gone", () => {
    enterGame(state());
    socket.receive("connect");
    socket.reply("room:resume", {ok: false, error: "room not found"});
    expect(screen.getByText("Create Room")).toBeTruthy();
    expect(toast()).toBe("That game is no longer available.");
    expect(sessionStorage.getItem("villain.seat")).toBeNull();
  });

  it("returns home if the seat was opened somewhere else", () => {
    enterGame(state());
    socket.receive("disconnect", "io server disconnect");
    expect(screen.getByText("Create Room")).toBeTruthy();
    expect(toast()).toBe("This game was opened somewhere else.");
  });

  it("lets an invite to a different room win over an old seat", () => {
    sessionStorage.setItem("villain.seat", JSON.stringify(SEAT));
    window.history.replaceState(null, "", "/?room=other");
    render(<App />);
    socket.receive("connect");
    expect(socket.sentOf("room:resume")).toHaveLength(0);
    expect(screen.getByText("Join this room")).toBeTruthy();
  });

  it("does not try to resume when there is no saved seat", () => {
    render(<App />);
    socket.receive("connect");
    expect(socket.sentOf("room:resume")).toHaveLength(0);
  });

  it("refuses to send while offline rather than queueing a stale click", () => {
    enterGame(state());
    socket.connected = false;
    fireEvent.click(screen.getByText("End Turn"));
    expect(socket.sentOf("game:endTurn")).toHaveLength(0);
    expect(toast()).toBe("Not connected");
  });
});

describe("the end of a game", () => {
  it("names the winners and lets the owner return to the lobby", () => {
    enterGame(state({won: true}, {phase: "ended", activePlayerId: null}));
    expect(screen.getByText("🏆 me")).toBeTruthy();
    fireEvent.click(screen.getByText("Back to lobby"));
    expect(socket.sentOf("game:backToLobby")).toHaveLength(1);
  });

  it("disables I Win after claiming", () => {
    enterGame(state({won: true}));
    expect((screen.getByText("I Win") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("leaving", () => {
  it("forgets the seat so a reload does not rejoin", () => {
    enterGame(state());
    fireEvent.click(screen.getByText("Leave Room"));
    expect(sessionStorage.getItem("villain.seat")).toBeNull();
    expect(screen.getByText("Create Room")).toBeTruthy();
    expect(socket.sentOf("room:leave")).toHaveLength(1);
  });
});

describe("errors", () => {
  it("show up in the lobby too", () => {
    enterGame(state({}, {phase: "lobby", activePlayerId: null}));
    fireEvent.click(screen.getByText("Start Game"));
    socket.reply("lobby:start", {ok: false, error: "not all ready"});
    expect(toast()).toBe("not all ready");
  });
});
