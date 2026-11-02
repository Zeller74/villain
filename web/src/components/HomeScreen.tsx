import { useState } from "react";
import type { GameClient } from "../useGameClient";

const FAN = ["lotso", "captain", "maleficent", "lady", "mother", "prince"];

//create or join a room. Someone arriving on an invite link only sees the join half
export function HomeScreen({ client }: { client: GameClient }) {
  const {invitedRoomId, status, createRoom, joinRoom} = client;
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState(invitedRoomId ?? "");
  const canJoin = !!name.trim() && !!roomId.trim();

  return (
    <main className="landing">
      <div className="landing__inner">
        <div className="landing__fan" aria-hidden="true">
          {FAN.map((id) => <img key={id} src={`/character/${id}Back.jpg`} alt="" />)}
        </div>

        <div className="landing__title">
          <h1 className="wordmark">Villainous</h1>
          <p className="landing__tag">
            {status === "connected" ? "Pick a villain. Play with friends." : "Connecting to the server…"}
          </p>
        </div>

        <div className="form-card frame">
          <label>
            <span className="label">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Jeff"
              maxLength={32}
            />
          </label>
        </div>

        {!invitedRoomId && (
          <>
            <div className="form-card frame">
              <h3>Create a room</h3>
              <p>We’ll generate a room ID for you.</p>
              <button className="btn-primary" onClick={() => createRoom(name.trim())} disabled={!name.trim()}>
                Create Room
              </button>
            </div>

            <div className="landing__or">or</div>
          </>
        )}

        <div className="form-card frame">
          <h3>{invitedRoomId ? "Join this room" : "Join a room"}</h3>
          <p>
            {invitedRoomId ? <>You’ve been invited to <code>{roomId}</code>.</> : "Paste the room ID from the host."}
          </p>
          <div className="form-row">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room ID (e.g., abc123)"
            />
            <button
              className={invitedRoomId ? "btn-primary" : undefined}
              onClick={() => joinRoom(roomId.trim(), name.trim())}
              disabled={!canJoin}
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
