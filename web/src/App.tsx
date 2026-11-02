import { GameScreen } from "./components/GameScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LobbyScreen } from "./components/LobbyScreen";
import { useGameClient } from "./useGameClient";

export default function App() {
  const client = useGameClient();
  const {room, status, lastError} = client;

  return (
    <>
      {room && status !== "connected" && (
        <div className="connection-banner">Connection lost. Reconnecting, your seat is being held…</div>
      )}

      {!room && <HomeScreen client={client} />}
      {room && room.game.phase === "lobby" && <LobbyScreen client={client} room={room} />}
      {room && room.game.phase !== "lobby" && <GameScreen client={client} room={room} />}

      {lastError && <div role="alert" className="toast">{lastError}</div>}
    </>
  );
}
