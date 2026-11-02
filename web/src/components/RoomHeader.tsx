import { useState } from "react";

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

export function RoomHeader({ roomId, onLeave }: { roomId: string; onLeave: () => void }) {
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
    <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <strong>Room:</strong> <code>{roomId}</code>
      <button onClick={copyInviteLink} title="Copy invite link">
        {copied ? "Copied!" : "Copy Link"}
      </button>
      <span style={{ marginLeft: "auto" }} />
      <button onClick={onLeave}>Leave Room</button>
    </p>
  );
}
