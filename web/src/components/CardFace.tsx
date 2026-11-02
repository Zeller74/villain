import { useContext, useEffect, useState } from "react";
import { CardPreviewContext } from "../cardPreview";
import { cx } from "../cx";
import type { Card } from "../protocol";
import { Icon } from "./Icon";

type CardFaceProps = {
  card: Card;
  locked?: boolean;
  active?: boolean; //the card being moved
  onClick?: () => void;
  canLock?: boolean;
  onToggleLock?: (nextLocked: boolean) => void;
  canAdjustStrength?: boolean;
  onAdjustStrength?: (delta: number) => void;
  size?: "sm" | "md" | "lg";
  title?: string;
};

export function CardFace({
  card,
  locked = false,
  active = false,
  onClick,
  canLock = false,
  onToggleLock,
  canAdjustStrength = false,
  onAdjustStrength,
  size = "md",
  title,
}: CardFaceProps) {
  const setPreview = useContext(CardPreviewContext);
  const [failedArt, setFailedArt] = useState<string | null>(null);
  const cardId = card.id;

  //a card that leaves play gets no mouse-leave, so its preview has to be cleared here
  useEffect(() => () => setPreview?.(shown => shown?.id === cardId ? null : shown), [setPreview, cardId]);

  const hasBase = card.baseStrength !== null;
  const strengthText = card.strength > 0 ? `+${card.strength}` : `${card.strength}`;
  const adjustClass = cx("card__adjust", card.strength > 0 && "is-up", card.strength < 0 && "is-down");

  return (
    <div
      className={cx("card", `card--${size}`, onClick && "is-clickable", locked && "is-locked", active && "is-active")}
      data-type={card.type}
      title={title ?? card.label}
      onClick={onClick && ((e) => {
        //a card is a target of its own; the zone behind it should not react too
        e.stopPropagation();
        onClick();
      })}
      onMouseEnter={() => setPreview?.(card)}
      onMouseLeave={() => setPreview?.(null)}
    >
      {/* sits over the parchment card, which stays underneath for any card without an image */}
      {failedArt !== card.art && (
        <img
          className="card__art"
          src={`/cards/${card.art}.webp`}
          alt=""
          draggable={false}
          onError={() => setFailedArt(card.art)}
        />
      )}

      <div className="card__ribbon" title={`Type: ${card.type}`}>{card.type}</div>

      {card.cost !== null && <div className="card__cost" title="Cost">{card.cost}</div>}

      {canLock && (
        <button
          className={cx("card__lock", locked && "is-on")}
          onClick={(e) => {
            e.stopPropagation();
            onToggleLock?.(!locked);
          }}
          title={locked ? "Unlock card" : "Lock card"}
        >
          <Icon name={locked ? "lock" : "unlock"} />
        </button>
      )}

      <div className="card__body">
        <div className="card__name">{card.label}</div>
        {card.desc && <div className="card__text">{card.desc}</div>}
      </div>

      {hasBase && <div className="card__strength" title="Printed strength">{card.baseStrength}</div>}

      {/* counters are public, even for a player who cannot change them */}
      {hasBase && !canAdjustStrength && card.strength !== 0 && (
        <div className={adjustClass} title="Current strength">{strengthText}</div>
      )}

      {hasBase && canAdjustStrength && (
        <div className="card__stepper">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStrength?.(-1);
            }}
            title="−1 strength"
          >
            −
          </button>
          <div className={adjustClass} title="Current strength">{strengthText}</div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStrength?.(+1);
            }}
            title="+1 strength"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
