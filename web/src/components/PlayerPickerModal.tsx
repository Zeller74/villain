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
    <Modal onClose={onClose} size="narrow" onTop>
      <div className="modal__head">
        <strong>{title}</strong>
        <button className="modal__spacer" onClick={onClose}>Close</button>
      </div>

      <div className="picker">
        {players.map(p => (
          <button key={p.id} onClick={() => onPick(p.id)}>{p.name}</button>
        ))}
      </div>
    </Modal>
  );
}
