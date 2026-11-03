import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captain } from "../src/data/characters/captain";
import { lady } from "../src/data/characters/lady";
import { lotso } from "../src/data/characters/lotso";
import { maleficent } from "../src/data/characters/maleficent";
import { mother } from "../src/data/characters/mother";
import { pete } from "../src/data/characters/pete";
import { prince } from "../src/data/characters/prince";
import { artPath, expandDeck } from "../src/game/cards";

const VILLAINS = [captain, lady, lotso, maleficent, mother, pete, prince];
const inPublic = (path: string) => existsSync(join(__dirname, "../../web/public", path));

describe("images", () => {
  it("has both sizes of every card", () => {
    const dealt = VILLAINS.flatMap(v => [...expandDeck(v.deck, v.id), ...expandDeck(v.fateDeck, v.id)]).map(c => c.art);
    const buzz = [artPath("lotso", "Buzz Lightyear"), artPath("lotso", "Demo Mode Buzz Lightyear")];
    const missing = [...dealt, ...buzz]
      .flatMap(art => [`cards/${art}.webp`, `cards/large/${art}.webp`])
      .filter(path => !inPublic(path));
    expect(missing).toEqual([]);
  });

  it("has a painting for every location", () => {
    const missing = VILLAINS.flatMap(v => v.locations.map((_, i) => `locations/${v.id}/L${i + 1}.webp`)).filter(path => !inPublic(path));
    expect(missing).toEqual([]);
  });
});
