import { useState } from "react";
import { cx } from "../cx";

//a villain's portrait, or their initials for one without art yet
export function Avatar({ characterId, name, portrait = false }: { characterId: string; name: string; portrait?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = `/character/${encodeURIComponent(characterId)}Prof.jpg`;
  const initials = name.split(" ").map(s => s[0]?.toUpperCase()).slice(0, 2).join("") || "?";

  return (
    <span className={cx("avatar", portrait && "avatar--portrait")} title={name}>
      {failedSrc === src ? initials : (
        <img src={src} alt={`${name} avatar`} draggable={false} onError={() => setFailedSrc(src)} />
      )}
    </span>
  );
}
