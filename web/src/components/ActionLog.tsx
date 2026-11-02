import { cx } from "../cx";
import type { LogItem } from "../protocol";

export function ActionLog({ items }: { items: LogItem[] }) {
  return (
    <section className="side-panel frame">
      <h3>Action log</h3>
      <div className="side-panel__scroll">
        {items.length === 0 && <div className="side-panel__empty">No actions yet.</div>}
        {items.map((item) => (
          <div
            key={item.id}
            className={cx("log-line", item.type === "undo" && "is-undo")}
            title={new Date(item.ts).toLocaleString()}
          >
            <time>{new Date(item.ts).toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}</time>
            {item.text}
          </div>
        ))}
      </div>
    </section>
  );
}
