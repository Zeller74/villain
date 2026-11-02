import { cx } from "../cx";
import type { RoomState } from "../protocol";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

//everyone at the table. Clicking a player shows their Realm
export function PlayerList({
  room,
  myId,
  focusId,
  characterName,
  onFocus,
}: {
  room: RoomState;
  myId: string | null;
  focusId: string | undefined;
  characterName: (id: string) => string;
  onFocus: (id: string) => void;
}) {
  return (
    <ul className="players">
      {room.players.map((p) => (
        <li key={p.id}>
          <button
            className={cx("player", p.id === focusId && "is-focused")}
            data-villain={p.characterId}
            aria-pressed={p.id === focusId}
            onClick={() => onFocus(p.id)}
          >
            {p.id === room.game.activePlayerId && <span className="player__turn" title="Their turn" />}
            <Avatar characterId={p.characterId} name={characterName(p.characterId)} />
            <span>
              <span className="player__name">{p.name}{p.id === myId ? " (you)" : ""}{p.connected ? "" : " (offline)"}</span>
              <span className="player__meta">{characterName(p.characterId)} · {p.counts.hand} in hand</span>
            </span>
            {p.won ? <Icon name="trophy" /> : <span className="player__power" title="Power">{p.power}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
