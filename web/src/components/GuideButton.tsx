import { useState } from "react";
import { GUIDES } from "../data/guides";
import { Modal } from "./Modal";

//the round "?" button, and the strategy guide it opens
export function GuideButton({ characterId }: { characterId: string | null }) {
  const [open, setOpen] = useState(false);
  const guide = characterId ? GUIDES[characterId] ?? null : null;

  return (
    <>
      <button
        className="help-btn"
        onClick={() => setOpen(true)}
        title="Open strategy guide"
        aria-label="Open strategy guide"
      >
        ?
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)} onTop boxClassName="guide">
          <div className="guide__head">
            <strong>{guide?.title ?? "Strategy Guide"}</strong>
            <button className="modal__spacer" onClick={() => setOpen(false)}>Close</button>
          </div>

          <div className="guide__art">
            {guide?.image ? <img src={guide.image} alt="" /> : <span className="modal__empty">No image</span>}
          </div>

          <div className="guide__body">
            {guide?.body ?? "No guide has been provided yet."}
          </div>
        </Modal>
      )}
    </>
  );
}
