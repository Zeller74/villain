import type { CharacterTemplate } from "../../types";

export const maleficent: CharacterTemplate = {
  id: "maleficent",
  name: "Maleficent",
  locations: [
    { name: "Forbidden Mountains", actions: ["moveItemAlly", "play", "gain1", "fate"], topSlots: 2 },
    { name: "Briar Rose's Cottage", actions: ["gain2", "moveItemAlly", "play", "discard"], topSlots: 2 },
    { name: "The Forest", actions: ["discard", "play", "gain3", "play"], topSlots: 2 },
    { name: "King Stefan's Castle", actions: ["gain1", "fate", "vanquish", "play"], topSlots: 2 },
  ],
  deck: [
    { label: "Cackling Goon", type: "Ally", description: "Cackling Goon gets +1 Strength for each Hero at his location.", cost: 1, strength: 1, copies: 3 },
    { label: "Dragon Form", type: "Effect", description: "Defeat a Hero with a Strength of 3 or less. If a Fate action targets you before your next turn, gain 3 Power.", cost: 3, strength: null, copies: 3 },
    { label: "Forest of Thorns", type: "Curse", description: "Heroes must have a Strength of 4 or more to be played to this location. Discard this Curse when a Hero is played to this location", cost: 2, strength: null, copies: 3 },
    { label: "Green Fire", type: "Curse", description: "Heroes cannot be played to this location. Discard this Curse if Maleficent moves to this location.", cost: 3, strength: null, copies: 3},
    { label: "Savage Goon", type: "Ally", description: "No additional Ability", cost: 3, strength: 4, copies: 3},
    { label: "Sinister Goon", type: "Ally", description: "Sinister Goon gets +1 Strength if there are any Curses at his location.", cost: 2, strength: 3, copies: 3},
    { label: "Vanish", type: "Effect", description: "On your next turn, Maleficent does not have to move to a new location", cost: 0, strength: null, copies: 3},
    { label: "Dreamless Sleep", type: "Curse", description: "Heroes at this location get -2 Strength. Discard this Curse when an Ally is played to this location.", cost: 3, strength: null, copies: 2},
    { label: "Malice", type: "Condition", description: "During their turn, if another player defeats a Hero with a Strength of 4 or more, you may play Malice. Defeat a Hero with a Strength of 4 or less.", cost: null, strength: null, copies: 2},
    { label: "Tyranny", type: "Condition", description: "During their turn, if another player has three or more Allies in their Realm, you may play Tyranny. Draw three crads into your hand, then discard any three cards.", cost: null, strength: null, copies: 2},
    { label: "Raven", type: "Ally", description: "Before Maleficent moves, you may move Raven to any location and perform one available action at his new location. Raven cannot perform Fate actions.", cost: 3, strength: 1, copies: 1},
    { label: "Spinning Wheel", type: "Item", description: "If a Hero is defeated at this location, gain Power equal to the Hero's Strength minus 1.", cost: 1, strength: null, copies: 1},
    { label: "Staff", type: "Item", description: "If Maleficent is at this location, the Cost to play an Effect or Curse is reduced by 1 Power.", cost: 1, strength: null, copies: 1},
  ],
  fateDeck: [
    { label: "Guards", type: "Hero", description: "When performing a Vanquish action to defeat Guards, at least two Allies must be used", cost: null, strength: 3, copies: 3},
    { label: "Sword of Truth", type: "Item", description: "When Sword of Truth is played attach it to a Hero with no other attached Items. That Hero gets +2 Strength. The Cost to play a Curse to this location is increased by 2 Power", cost: null, strength: 2, copies: 3},
    { label: "Once Upon a Dream", type: "Effect", description: "Discard a Curse from a location in Maleficent's Realm that has a Hero.", cost: null, strength: null, copies: 2},
    { label: "Aurora", type: "Hero", description: "When Aurora is played, reveal the top card of Maleficent's Fate deck. If it is a Hero, play it. Otherwise return it to the top of the deck.", cost: null, strength: 4, copies: 1},
    { label: "Fauna", type: "Hero", description: "When Fauna is played, you may discard Dreamless Sleep from her location.", cost: null, strength: 2, copies: 1},
    { label: "Flora", type: "Hero", description: "When Flora is played, Maleficent must reveal her hand. Until Flora is defeated. Maleficent must play with her hand revealed.", cost: null, strength: 3, copies: 1},
    { label: "King Hubert", type: "Hero", description: "When King Hubert is played, you may move one Ally from each adjacent location to his location", cost: null, strength: 3, copies: 1},
    { label: "King Stefan", type: "Hero", description: "When King Stefan is played, you may move Maleficent to any location.", cost: null, strength: 4, copies: 1},
    { label: "Merryweather", type: "Hero", description: "Curses cannot be played to Merryweather's location", cost: null, strength: 4, copies: 1},
    { label: "Prince Phillip", type: "Hero", description: "When Prince Phillip is played, you may discard all Allies from his location", cost: null, strength: 5, copies: 1},
  ],
};
