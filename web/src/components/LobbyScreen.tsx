import { cx } from "../cx";
import type { RoomState } from "../protocol";
import type { GameClient } from "../useGameClient";
import { Avatar } from "./Avatar";
import { GuideButton } from "./GuideButton";
import { RoomChat } from "./RoomChat";
import { RoomHeader } from "./RoomHeader";

export function LobbyScreen({ client, room }: { client: GameClient; room: RoomState }) {
  const {myId, status, messages, catalog, call, leaveRoom} = client;
  const me = room.players.find(p => p.id === myId) ?? null;
  const iAmOwner = room.ownerId === myId;
  const everyoneReady = room.players.length >= 2 && room.players.every(p => p.ready);
  const characterName = (id: string) => catalog.find(c => c.id === id)?.name ?? id;

  return (
    <div className="lobby" data-villain={me?.characterId}>
      <RoomHeader roomId={room.roomId} status={status} onLeave={leaveRoom} />

      <main className="lobby__main">
        <div className="lobby__column">
          <section className="lobby__panel frame">
            <h3>Players</h3>
            <p className="lobby__hint">Owner: {room.players.find(p => p.id === room.ownerId)?.name ?? "—"}</p>
            <ul className="seats">
              {room.players.map((p) => (
                <li key={p.id} className="seat">
                  <Avatar characterId={p.characterId} name={characterName(p.characterId)} />
                  <span className="seat__who">
                    {p.name}{p.id === room.ownerId ? " (owner)" : ""}{myId === p.id ? " — you" : ""}{!p.connected ? " — offline" : ""}
                    <small>as {characterName(p.characterId)}</small>
                  </span>
                  <span className={cx("seat__state", p.ready && "is-ready")}>{p.ready ? "Ready" : "Not ready"}</span>
                </li>
              ))}
            </ul>

            {me && (
              <div className="lobby__ready">
                <label>
                  <input
                    type="checkbox"
                    checked={me.ready}
                    onChange={(e) => call("lobby:setReady", {ready: e.target.checked})}
                  />
                  Ready
                </label>
                <GuideButton characterId={me.characterId} />
              </div>
            )}

            <button
              className="btn-primary lobby__start"
              onClick={() => call("lobby:start", {})}
              disabled={!iAmOwner || !everyoneReady}
              title={!iAmOwner ? "Owner only" : (!everyoneReady ? "Need at least 2 players, all ready" : "Start")}
            >
              Start Game
            </button>
            {!iAmOwner && <p className="lobby__hint">Only the owner can start the game.</p>}
            {iAmOwner && !everyoneReady && <p className="lobby__hint">Needs at least 2 players, all ready.</p>}
          </section>

          <RoomChat className="lobby__chat" messages={messages} myId={myId} call={call} />
        </div>

        <section className="lobby__panel frame">
          <h3>Choose your villain</h3>
          <div className="villains">
            {catalog.map((c) => {
              const players = room.players.filter(p => p.characterId === c.id).map(p => p.name);
              return (
                <button
                  key={c.id}
                  className={cx("villain", me?.characterId === c.id && "is-chosen")}
                  data-villain={c.id}
                  aria-pressed={me?.characterId === c.id}
                  disabled={!me}
                  onClick={() => call("lobby:chooseCharacter", {characterId: c.id})}
                >
                  <Avatar characterId={c.id} name={c.name} portrait />
                  <span className="villain__name">{c.name}</span>
                  {players.length > 0 && <span className="villain__taken">{players.join(", ")}</span>}
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
