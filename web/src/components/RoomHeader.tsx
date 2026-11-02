import { useState, type ReactNode } from "react";
import type { ConnectionStatus } from "../useGameClient";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export function RoomHeader({
  roomId,
  status,
  onLeave,
  center,
  actions,
}: {
  roomId: string;
  status: ConnectionStatus;
  onLeave: () => void;
  center?: ReactNode;
  actions?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copyInviteLink = async () => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("room", roomId);
    await copyText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <header className="topbar">
      <span className="wordmark">Villainous</span>
      <div className="topbar__room">
        <span className="status-dot" data-status={status} title={`Socket: ${status}`} />
        <span>Room <code>{roomId}</code></span>
        <button onClick={copyInviteLink} title="Copy invite link">
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
      <div className="topbar__center">{center}</div>
      <div className="topbar__actions">
        {actions}
        <button onClick={onLeave}>Leave Room</button>
      </div>
    </header>
  );
}
