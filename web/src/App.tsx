import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { useGameClient } from "./useGameClient";

export default function App() {
  const client = useGameClient();
  const {room, status, lastError} = client;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16}}>
      <h1>Villainous</h1>
      <p>Socket: <strong>{status}</strong></p>

      <hr />

      {room && status !== "connected" && (
        <div style={{ padding: "6px 10px", marginBottom: 8, borderRadius: 8, background: "#7f1d1d", color: "#fee2e2" }}>
          Connection lost. Reconnecting, your seat is being held…
        </div>
      )}

      {!room && <HomeScreen client={client} />}
      {room && room.game.phase === "lobby" && <LobbyScreen client={client} room={room} />}
      {room && room.game.phase !== "lobby" && <GameScreen client={client} room={room} />}

      {lastError && (
        <div role="alert" style={{
          position: "fixed", top: 16, right: 16, zIndex: 300,
          background: "#b91c1c", color: "white",
          padding: "8px 12px", borderRadius: 8,
          boxShadow: "0 6px 18px rgba(0,0,0,.35)"
        }}>
          {lastError}
        </div>
      )}
    </div>
  );
}
