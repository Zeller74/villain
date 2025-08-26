import { useEffect, useRef, useState } from 'react';
import {makeSocket} from "./socket";

type WelcomeMsg = { id: string; ts: number };

export default function App() {
  const sockRef = useRef<ReturnType<typeof makeSocket> | null>(null);

  //connection status and welcome paylod
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [welcome, setWelcome] = useState<WelcomeMsg | null>(null);

  useEffect(() => {
    const s = makeSocket();
    sockRef.current = s;

    s.on("connect", () => setStatus("connected"));
    s.on("disconnect", () => setStatus("disconnected"));

    s.on("server:welcome", (msg: WelcomeMsg) => {
      setWelcome(msg);
    });

    return () => {
      s.close();
    };
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1>Villainous</h1>
      <p>
        Status: <strong>{status}</strong>
      </p>

      {welcome ? (
        <p>
          Welcome from server — socket id: <code>{welcome.id}</code>, time:{" "}
          {new Date(welcome.ts).toLocaleTimeString()}
        </p>
      ) : (
        <p>Waiting for welcome…</p>
      )}

    </div>
  );
}