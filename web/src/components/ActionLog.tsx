import type { LogItem } from "../protocol";
import { panel } from "../theme";

export function ActionLog({ items }: { items: LogItem[] }) {
  return (
    <div style={{ ...panel, marginTop: 12, padding: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>Action log</h3>
      <div
        style={{
          marginTop: 8,
          maxHeight: 240,
          overflowY: "auto",
          display: "grid",
          gap: 6,
        }}
      >
        {items.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 12 }}>No actions yet.</div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              style={{ fontSize: 12, opacity: item.type === "undo" ? 0.75 : 1 }}
              title={new Date(item.ts).toLocaleString()}
            >
              <span style={{ opacity: 0.7, marginRight: 6 }}>
                {new Date(item.ts).toLocaleTimeString()}
              </span>
              <span>{item.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
