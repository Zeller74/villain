import type { PublicPlayer } from "../protocol";
import type { Call } from "../useGameClient";
import { CharacterMenu } from "./CharacterMenu";
import { FateBar } from "./FateBar";
import { GuideButton } from "./GuideButton";

function Stat({ label, value, onChange }: { label: string; value: string | number; onChange?: ((delta: number) => void) | undefined }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      {onChange && <button onClick={() => onChange(-1)}>-1</button>}
      <span className="stat__value">{value}</span>
      {onChange && <button onClick={() => onChange(+1)}>+1</button>}
    </div>
  );
}

export function RealmHeader({
  player,
  characterName,
  viewingSelf,
  canAct,
  opponents,
  call,
  onError,
  onOpenFateDiscard,
}: {
  player: PublicPlayer;
  characterName: string;
  viewingSelf: boolean;
  canAct: boolean;
  opponents: PublicPlayer[];
  call: Call;
  onError: (message: string) => void;
  onOpenFateDiscard: (playerId: string) => void;
}) {
  const canChange = viewingSelf && canAct;

  return (
    <header className="realm-header frame">
      <CharacterMenu
        player={player}
        characterName={characterName}
        viewingSelf={viewingSelf}
        canAct={canAct}
        call={call}
        onError={onError}
      />

      <div className="realm-header__title">
        <h2>{viewingSelf ? characterName : `Viewing: ${player.name} (${characterName})`}</h2>
        <GuideButton characterId={player.characterId} />
      </div>

      <div className="stats">
        <Stat
          label="Power"
          value={player.power}
          onChange={canChange ? (delta) => call("power:change", {delta}) : undefined}
        />
        {player.characterId === "mother" && (
          <Stat
            label="Trust"
            value={player.trust}
            onChange={canChange ? (delta) => call("trust:change", {delta}) : undefined}
          />
        )}
        <Stat label="Pawn" value={`L${player.board.moverAt + 1}`} />
      </div>

      <FateBar
        focusPlayer={player}
        viewingSelf={viewingSelf}
        canAct={canAct}
        opponents={opponents}
        onStartFate={(targetId) => call("fate:start", {targetId})}
        onReshuffleFate={(playerId) => call("fate:reshuffleDeck", {playerId})}
        onOpenFateDiscard={onOpenFateDiscard}
      />
    </header>
  );
}
