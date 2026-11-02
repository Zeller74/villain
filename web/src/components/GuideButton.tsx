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
        onClick={() => setOpen(true)}
        title="Open strategy guide"
        aria-label="Open strategy guide"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "1px solid #a1a1a1ff",
          color: "#e5e7eb",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          lineHeight: 1,
          fontSize: 14,
          cursor: "pointer",
          padding: 0,
        }}
      >
        ?
      </button>

      {open && (
        <Modal
          onClose={() => setOpen(false)}
          width="min(1400px, 95vw)"
          maxHeight="85vh"
          zIndex={200}
          style={{
            overflow: "hidden",
            padding: 0,
            background: "#0b1220",
            boxShadow: "0 16px 40px rgba(0,0,0,.5)",
            display: "grid",
            gridTemplateColumns: "300px 1fr",
          }}
        >
          {/* header */}
          <div style={{ gridColumn: "1 / -1", padding: "10px 12px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center" }}>
            <strong>{guide?.title ?? "Strategy Guide"}</strong>
            <span style={{ marginLeft: "auto" }} />
            <button onClick={() => setOpen(false)}>Close</button>
          </div>

          {/* image left */}
          <div style={{ borderRight: "1px solid #1f2937", padding: 12, display: "grid", placeItems: "center" }}>
            {guide?.image ? (
              <img
                src={guide.image}
                alt=""
                style={{ maxWidth: "100%", height: "auto", borderRadius: 8, border: "1px solid #334155" }}
              />
            ) : (
              <div style={{ opacity: 0.6 }}>No image</div>
            )}
          </div>

          {/* text right */}
          <div style={{ padding: 12, overflowY: "auto" }}>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {guide?.body ?? "No guide has been provided yet."}
            </div>
          </div>

          {/* responsive tweak: stack on small screens */}
          <style>{`
            @media (max-width: 720px) {
              [role="dialog"] > div { grid-template-columns: 1fr; }
            }
          `}</style>
        </Modal>
      )}
    </>
  );
}
