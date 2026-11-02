import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChatMsg } from "../protocol";
import type { Call } from "../useGameClient";

const boxStyle: CSSProperties = {
  border: "1px solid #334155",
  borderRadius: 8,
  padding: 8,
  height: 200,
  overflowY: "auto",
  background: "#242424",
  color: "#e5e7eb",
  marginBottom: 8,
};

export function RoomChat({ messages, myId, call }: { messages: ChatMsg[]; myId: string | null; call: Call }) {
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (text) call("chat:send", {text}, () => setDraft(""));
  };

  return (
    <div>
      <p><strong>Room chat</strong></p>
      <div ref={boxRef} style={boxStyle}>
        {messages.length === 0 && (
          <div style={{ opacity: 0.6 }}>No messages yet.</div>
        )}
        {messages.map((m) => {
          const mine = m.playerId === myId;
          const time = new Date(m.ts).toLocaleTimeString();
          return (
            <div key={m.id} style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: mine ? 700 : 600 }}>
                {m.name}:
              </span>{" "}
              <span>{m.text}</span>
              <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 12 }}>
                {time}
              </span>
            </div>
          );
        })}
      </div>

      <div className="chat" style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message"
          maxLength={300}
          style={{
            flex: 1,
            padding: 8,
            background: "#1f2937",
            color: "#f1f5f9",
            border: "1px solid #334155",
            borderRadius: 6,
            outline: "none",
            caretColor: "#f1f5f9",
          }}
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          style={{
            padding: "8px 12px",
            background: "#334155",
            color: "#e5e7eb",
            border: "1px solid #475569",
            borderRadius: 6,
            cursor: !draft.trim() ? "not-allowed" : "pointer",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
