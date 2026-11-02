import type { PublicPlayer } from "../protocol";
import { Modal } from "./Modal";

export function PlayerPickerModal({
  title,
  players,
  onPick,
  onClose,
}: {
  title: string;
  players: PublicPlayer[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} width="min(420px, 92vw)" zIndex={120}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <strong>{title}</strong>
        <span style={{ marginLeft: "auto" }} />
        <button onClick={onClose}>Close</button>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            style={{
              textAlign: "left", padding: "8px 10px", borderRadius: 8,
              border: "1px solid #334155", background: "#0b1220", color: "#e5e7eb",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}
