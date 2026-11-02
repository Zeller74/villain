import { makeBuzz, makeDemoBuzz, take } from "../game/cards";
import { fail } from "../game/errors";
import type { Binder } from "./binder";

export function registerCharacterHandlers({on}: Binder) {
  on("char:toggleHandReveal", "playing", ({me, commit}) => {
    if (me.characterId !== "maleficent") fail("only Maleficent can reveal hand");
    me.handPublic = !me.handPublic;
    commit({type: "reveal_hand", next: me.handPublic});
    return {next: me.handPublic};
  });

  on("lotso:flipBuzz", "action", ({me, commit}) => {
    if (me.characterId !== "lotso") fail("only Lotso can flip Buzz");

    for (const [i, loc] of me.board.locations.entries()) {
      const index = i as 0 | 1 | 2 | 3;

      const guardian = loc.top.find(c => c.label === "Buzz Lightyear");
      if (guardian) {
        take(loc.top, guardian.id);
        const flipped = makeDemoBuzz();
        loc.bottom.push(flipped);
        return commit({type: "char_flip_buzz", loc: index, fromLabel: guardian.label, toLabel: flipped.label});
      }

      const demo = loc.bottom.find(c => c.label === "Demo Mode Buzz Lightyear");
      if (demo) {
        take(loc.bottom, demo.id);
        const flipped = makeBuzz();
        loc.top.push(flipped);
        return commit({type: "char_flip_buzz", loc: index, fromLabel: demo.label, toLabel: flipped.label});
      }
    }

    fail("Buzz (any side) not found on your board");
  });
}
