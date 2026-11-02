import type { CharacterPreview } from "../../protocol";
import type { CharacterTemplate } from "../../types";
import { captain } from "./captain";
import { lady } from "./lady";
import { lotso } from "./lotso";
import { maleficent } from "./maleficent";
import { mother } from "./mother";
import { pete } from "./pete";
import { prince } from "./prince";

const CHARACTER_LIST: readonly CharacterTemplate[] = [maleficent, captain, prince, lady, mother, lotso, pete];
const CHARACTERS = new Map(CHARACTER_LIST.map(c => [c.id, c]));

export const DEFAULT_CHARACTER_ID = maleficent.id;

export function isCharacterId(id: string) {
  return CHARACTERS.has(id);
}

export function getCharacter(id: string): CharacterTemplate {
  return CHARACTERS.get(id) ?? maleficent;
}

export function characterPreviews(): CharacterPreview[] {
  return CHARACTER_LIST.map(({id, name, locations}) => ({id, name, locations}));
}
