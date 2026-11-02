# Villainous Online

A browser version of the Disney Villainous board game for 2 or more players. One person creates a room, shares the invite link, and everyone plays from their own screen.

The server tracks cards, turns and hidden information. It does not enforce the rules of each card: players apply those themselves, as at a real table, using the move, lock and strength controls.

## Running it

Needs Node 20.19 or newer (or 22.12+).

```sh
npm install
npm run dev -w server   # http://localhost:3001
npm run dev -w web      # http://localhost:5173
```

To play against yourself, open a second browser tab. Each tab is its own player, and keeps its seat through a reload.

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the server and client tests |
| `npm run build` | Builds both packages |
| `npm run lint` | Lints the client |
| `npm run typecheck -w server` | Type-checks the server and its tests |

## How it's organised

```
server/src/
  index.ts          starts the server
  app.ts            wires sockets to handlers, sets the grace periods
  protocol.ts       every event and message between client and server
  types.ts          server-only types
  data/characters/  one file per villain
  game/             rules-free game logic: cards, turns, rooms, undo, the log
  handlers/         one function per client event, grouped by area
    binder.ts       the wrapper every event goes through
    schemas.ts      the validation rule for every event

web/src/
  App.tsx           picks the home, lobby or game screen
  useGameClient.ts  owns the socket and everything the server sends
  protocol.ts       identical copy of the server's protocol.ts
  components/       screens, board, modals
  data/guides.ts    strategy guide text
```

`server/` and `web/` each build on their own, which is why `protocol.ts` exists twice instead of being a shared package. A test fails if the two copies differ, so after changing one, copy it over the other.

## Adding a villain

1. Add `server/src/data/characters/<id>.ts` and list it in `data/characters/index.ts`.
2. If the villain starts with something in play, add it to `SPECIAL_SETUP` in `game/setup.ts`.
3. Add `<id>Prof.jpg` and `<id>Back.jpg` to `web/public/character/`. Missing images fall back to initials and a default card back.
4. Add a guide to `web/src/data/guides.ts`, and any character actions to `menus` in `web/src/components/PlayerPanel.tsx`.

## Adding a client event

1. Declare it in `ClientEvents` in `protocol.ts`, and copy that file to the other package.
2. Add its validation to `handlers/schemas.ts`. The build fails until every event has one.
3. Handle it with `on(event, requirement, handler)`. Throw with `fail("message")` to refuse the action; the player sees the message. Call `commit()` to broadcast, passing an action to log it.

## Reconnecting

Players are identified by a stable id and a secret seat token, not by their socket. Dropping out holds the seat for 30 seconds in the lobby or 5 minutes in a game, and the client reclaims it automatically. Other players see that person as offline, and the game waits for them if it's their turn. When the grace period ends they are removed, any open fate cards go back, and the turn passes on. The times are in `app.ts`.

Rooms live in memory, so restarting the server ends every game.

## Deploying

The two packages deploy separately. Build output is not committed, so the host has to build.

**Server:** from `server/`, run `npm install --include=dev`, then `npm run build`, then `npm start`. The build needs TypeScript, which is a dev dependency.

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on. Defaults to 3001. |
| `CORS_ORIGIN` | Comma-separated list of allowed client origins. |

`GET /healthz` returns 200 for host health checks.

**Client:** run `npm run build` from `web/` and serve `web/dist`.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | The server's URL, set at build time. Defaults to the site's own origin. |
