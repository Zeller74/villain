import { useState, type CSSProperties } from "react";
import type { GameClient } from "../useGameClient";

const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 };

//create or join a room. Someone arriving on an invite link only sees the join half
export function HomeScreen({ client }: { client: GameClient }) {
  const {invitedRoomId, createRoom, joinRoom} = client;
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(invitedRoomId ?? "");
  const canJoin = !!name.trim() && !!roomId.trim();

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
      <label>
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Jeff"
          maxLength={32}
          style={{ display: "block", width: "100%", padding: 8, marginTop: 4 }}
        />
      </label>

      {!invitedRoomId && (
        <>
          <div style={card}>
            <h3 style={{ margin: 0 }}>Create a room</h3>
            <p style={{ marginTop: 6, opacity: 0.75 }}>We’ll generate a room ID for you.</p>
            <button onClick={() => createRoom(name.trim())} disabled={!name.trim()}>
              Create Room
            </button>
          </div>

          <div style={{ textAlign: "center", opacity: 0.6 }}>— or —</div>
        </>
      )}

      <div style={card}>
        <h3 style={{ margin: 0 }}>{invitedRoomId ? "Join this room" : "Join a room"}</h3>
        <p style={{ marginTop: 6, opacity: 0.75 }}>
          {invitedRoomId ? <>You’ve been invited to <code>{roomId}</code>.</> : "Paste the room ID from the host."}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID (e.g., abc123)"
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={() => joinRoom(roomId.trim(), name.trim())} disabled={!canJoin}>
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
