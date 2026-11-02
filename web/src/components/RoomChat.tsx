import { useEffect, useRef, useState } from "react";
import { cx } from "../cx";
import type { ChatMsg } from "../protocol";
import type { Call } from "../useGameClient";

export function RoomChat({ messages, myId, call, className }: { messages: ChatMsg[]; myId: string | null; call: Call; className?: string }) {
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
    <section className={cx("side-panel frame", className)}>
      <h3>Room chat</h3>
      <div ref={boxRef} className="side-panel__scroll">
        {messages.length === 0 && <div className="side-panel__empty">No messages yet.</div>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cx("chat-line", m.playerId === myId && "is-mine", m.playerId === "system" && "is-system")}
          >
            {m.playerId !== "system" && <b>{m.name}: </b>}
            {m.text}
            <time>{new Date(m.ts).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}</time>
          </div>
        ))}
      </div>

      <div className="chat">
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
        />
        <button onClick={send} disabled={!draft.trim()}>Send</button>
      </div>
    </section>
  );
}
