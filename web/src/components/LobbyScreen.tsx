import type { RoomState } from "../protocol";
import type { GameClient } from "../useGameClient";
import { GuideButton } from "./GuideButton";
import { RoomChat } from "./RoomChat";
import { RoomHeader } from "./RoomHeader";

export function LobbyScreen({ client, room }: { client: GameClient; room: RoomState }) {
  const {myId, messages, catalog, call, leaveRoom} = client;
  const me = room.players.find(p => p.id === myId) ?? null;
  const iAmOwner = room.ownerId === myId;
  const everyoneReady = room.players.length >= 2 && room.players.every(p => p.ready);
  const characterName = (id: string) => catalog.find(c => c.id === id)?.name ?? id;

  return (
    <div>
      <RoomHeader roomId={room.roomId} onLeave={leaveRoom} />

      <p style={{ marginTop: 8 }}>
        <strong>Owner:</strong> {room.players.find(p => p.id === room.ownerId)?.name ?? "—"}
      </p>

      {/*player list with ready and characters*/}
      <ul style={{ marginTop: 8 }}>
        {room.players.map((p) => (
          <li key={p.id} style={{ marginBottom: 4 }}>
            {p.name} {p.id === room.ownerId ? "(owner)" : ""} —{" "}
            <span>{p.ready ? "✅ ready" : "⌛ not ready"}</span>{" "}
            <span style={{ opacity: 0.7, marginLeft: 8 }}>as {characterName(p.characterId)}</span>
            {!p.connected ? " — offline" : ""}
            {myId === p.id ? " — you" : ""}
          </li>
        ))}
      </ul>

      {/*character select and ready*/}
      {me && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <label>
            Character{" "}
            <select
              value={me.characterId}
              onChange={(e) => call("lobby:chooseCharacter", {characterId: e.target.value})}
              style={{ padding: 6 }}
            >
              {catalog.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <GuideButton characterId={me.characterId} />

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={me.ready}
              onChange={(e) => call("lobby:setReady", {ready: e.target.checked})}
            />
            Ready
          </label>
        </div>
      )}

      {/*owner start button*/}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => call("lobby:start", {})}
          disabled={!iAmOwner || !everyoneReady}
          title={!iAmOwner ? "Owner only" : (!everyoneReady ? "Need at least 2 players, all ready" : "Start")}
        >
          Start Game
        </button>
        {!iAmOwner && <span style={{ marginLeft: 8, opacity: 0.7 }}>(owner only)</span>}
        {iAmOwner && !everyoneReady && <span style={{ marginLeft: 8, opacity: 0.7 }}>(need ≥2 players, all ready)</span>}
      </div>

      <hr />

      <RoomChat messages={messages} myId={myId} call={call} />
    </div>
  );
}
