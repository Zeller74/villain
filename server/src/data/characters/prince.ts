import type { CharacterTemplate } from "../../types";

export const prince: CharacterTemplate = {
  id: "prince",
  name: "Prince John",
  locations: [
    { name: "Sherwood Forest", actions: ["gain1", "discard", "play", "fate"], topSlots: 2 },
    { name: "Friar Tuck's Church", actions: ["gain2", "play", "play", "moveItemAlly"], topSlots: 2 },
    { name: "Nottingham", actions: ["fate", "gain1", "vanquish", "play"], topSlots: 2 },
    { name: "The Jail", actions: ["gain3", "play", "discard"], topSlots: 0 },
  ],
  deck: [
    { label: "Beautiful, Lovely Taxes", type: "Effect", description: "Gain 1 Power for each Hero in your Realm", cost: 0, strength: null, copies: 3},
    { label: "Imprison", type: "Effect", description: "Move a Hero to The Jail", cost: 2, strength: null, copies: 3},
    { label: "Rhino Guards", type: "Ally", description: "No additional Ability", cost: 3, strength: 4, copies: 3},
    { label: "Warrant", type: "Item", description: "Gain 2 Power each time a Hero is played to this location.", cost: 1, strength: null, copies: 3},
    { label: "Wolf Archers", type: "Ally", description: "When performing a Vanquish action, Wolf Archers may be used to defeat a Hero at their location or at an adjacent location.", cost: 2, strength: 2, copies: 3},
    { label: "Bow and Arrows", type: "Item", description: "When Bow and Arrows is played, attach it to an Ally. That Ally gets +1 Strength. When that Ally would be discarded, discard this Item instead.", cost: 1, strength: 1, copies: 2},
    { label: "Cowardice", type: "Condition", description: "During their turn, if another player has three or more Allies in their Realm, you may play Cowardice. Play an Ally from your hand for free.", cost: null, strength: null, copies: 2},
    { label: "Greed", type: "Condition", description: "During their turn, if another player has 6 or more Power, you may play Greed. Gain 3 Power", cost: null, strength: null, copies: 2},
    { label: "Set a Trap", type: "Effect", description: "You may move an Ally to any location. Perform a Vanquish action.", cost: 1, strength: null, copies: 2},
    { label: "Golden Arrow", type: "Item", description: "When Golden Arrow is played, attach it to an Ally. When that Ally is used to defeat a Hero, gain 2 Power.", cost: 0, strength: null, copies: 1},
    { label: "Intimidation", type: "Effect", description: "Perform a Vanquish action, but do not discard the Allies used to defeat the Hero", cost: 2, strength: null, copies: 1},
    { label: "King Richard's Crown", type: "Item", description: "If Prince John is at this location, all card Costs are reduced by 1 Power.", cost: 1, strength: null, copies: 1},
    { label: "Nutsy", type: "Ally", description: "All other Allies at Nutsy's location get +1 Strength", cost: 2, strength: 2, copies: 1},
    { label: "Sheriff of Nottingham", type: "Ally", description: "Before Prince John moves, you may move Sheriff of Nottingham to any location and gain 1 Power if there are any Heroes at his new location.", cost: 3, strength: 3, copies: 1},
    { label: "Sir Hiss", type: "Ally", description: "If Prince John is at Sir Hiss's location, you may perform one action that is covered by a Hero at that location.", cost: 2, strength: 2, copies: 1},
    { label: "Trigger", type: "Ally", description: "All other Allies at Trigger's location get -1 Strength.", cost: 2, strength: 4, copies: 1},
    
  ],
  fateDeck: [
    { label: "Clever Disguise", type: "Item", description: "When Clever Disguise is played, attach it to a Hero. That Hero cannot be defeated. At any time, Prince John may pay 2 Power to discard Clever Disguise.", cost: null, strength: null, copies: 3},
    { label: "Steal from the Rich", type: "Effect", description: "Take up to 4 Power from Prince John and put it on any one Hero. When that Hero is defeated, the Power is returned to Prince John.", cost: null, strength: null, copies: 3},
    { label: "Alan-A-Dale", type: "Hero", description: "All other Heroes in Prince John's Realm get +1 Strength.", cost: null, strength: 2, copies: 1},
    { label: "Friar Tuck", type: "Hero", description: "When Friar Tuck is played, you may discard all Warrants from his location. Prince John does not gain any Power from them.", cost: null, strength: 3, copies: 1},
    { label: "King Richard", type: "Hero", description: "Prince John cannot play Effects.", cost: null, strength: 5, copies: 1},
    { label: "Lady Kluck", type: "Hero", description: "Lady Kluck cannot be played or moved to The Jail.", cost: null, strength: 6, copies: 1},
    { label: "Little John", type: "Hero", description: "When Little John is played, you may take up to 4 Power from Prince John and put it on Little John. When Little John is defeated, the Power is returned to Prince John.", cost: null, strength: 5, copies: 1},
    { label: "Maid Marian", type: "Hero", description: "When Maid Marian is defeated, find Robin Hood and play him to the same location.", cost: null, strength: 3, copies: 1},
    { label: "Robin Hood", type: "Hero", description: "The amount of Power that Prince John gains from each card or action is reduced by 1 Power.", cost: null, strength: 5, copies: 1},
    { label: "Skippy", type: "Hero", description: "Wolf Archers cannot be used to defeat Skippy.", cost: null, strength: 2, copies: 1},
    { label: "Toby", type: "Hero", description: "When Toby is defeated, shuffle him back into Prince John's Fate deck.", cost: null, strength: 2, copies: 1},
  ],
};
