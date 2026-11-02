import type { CharacterTemplate } from "../../types";

export const pete: CharacterTemplate = {
  id: "pete",
  name: "Pete",
  locations: [
    { name: "Frontier Town", actions: ["play", "gain2", "moveItemAlly", "vanquish"], topSlots: 2 },
    { name: "Service Station", actions: ["gain1", "play", "fate", "discard"], topSlots: 2 },
    { name: "The Airport", actions: ["moveItemAlly", "fate", "play", "gain1"], topSlots: 2 },
    { name: "Podunk Landing", actions: ["discard", "play", "play", "gain3"], topSlots: 2 },
  ],
  deck: [
    { label: "Bandit", type: "Ally", description: "You may play any number of Bandits as part of the same Play a Card action", cost: 2, strength: 3, copies: 7},
    { label: "Play a Game", type: "Effect", description: "Reveal the top two cards of your deck. Gain Power equal to the sum of their Costs, then discard them.", cost: 2, strength: null, copies: 4},
    { label: "Horse", type: "Ally", description: "When Horse is played, you may move an Ally or Item in your Realm to any location.", cost: 1, strength: 2, copies: 3},
    { label: "Parrot", type: "Ally", description: "When Parrot is played, choose a card from your discard pile and put it into your hand.", cost: 1, strength: 1, copies: 3},
    { label: "Sneaky Pete", type: "Effect", description: "Draw two cards into your hand, then put one card from your hand on the top or bottom of your deck.", cost: 0, strength: null, copies: 3},
    { label: "Mischief", type: "Condition", description: "During their turn, if another player gains 3 or more Power, you may play Mischief. Draw two cards from the bottom of your deck, then put one card from your hand on the top or bottom of your deck.", cost: null, strength: null, copies: 2},
    { label: "Outrage", type: "Condition", description: "During their turn, if another player moves an Ally or Item, you may play Outrage. Defeat a Hero with a Strength of 3 or less.", cost: null, strength: null, copies: 2},
    { label: "Air Strike!", type: "Effect", description: "Move Pete to any location with a Hero and defeat them, then end your turn.", cost: 3, strength: null, copies: 1},
    { label: "Bank Loot", type: "Item", description: "Bank Loot can only be played to Frontier Town. This location gains: Gain 1", cost: 3, strength: null, copies: 1},
    { label: "Cricket", type: "Item", description: "Each time a Hero is played to your Realm, you may move Cricket to that Hero's location.", cost: 1, strength: 1, copies: 1},
    { label: "Jalopy", type: "Item", description: "Jalopy can only be played to Service Station. This location gains: Play", cost: 3, strength: null, copies: 1},
    { label: "Steamboat Willie", type: "Item", description: "Steamboat Willie can only be played to Podunk Landing. This location gains: Move Item/Ally", cost: 3, strength: null, copies: 1},
    { label: "Stolen Cargo", type: "Item", description: "Stolen Cargo can only be played to The Airport. This location gains: Gain 1", cost: 3, strength: null, copies: 1},
    
  ],
  fateDeck: [
    { label: "Hide", type: "Effect", description: "Discard a Bandit from Pete's Realm.", cost: null, strength: null, copies: 2},
    { label: "Knocked Silly", type: "Effect", description: "Reveal the top five cards of Pete's deck. Discard the cards with a Cost of 2 or more, and return the rest to the top of the deck in random order.", cost: null, strength: null, copies: 2},
    { label: "Outlawed", type: "Effect", description: "Pete loses up to 2 Power. You may reveal one Goal Token in Pete's Realm.", cost: null, strength: null, copies: 2},
    { label: "Clarabelle Cow", type: "Hero", description: "When Clarabelle Cow is played, you may reveal one Goal Token in Pete's Realm.", cost: null, strength: 2, copies: 1},
    { label: "Donald Duck", type: "Hero", description: "Pete must defeat Donald Duck before defeating other Heroes.", cost: null, strength: 3, copies: 1},
    { label: "Goofy", type: "Hero", description: "When Goofy is played, you may switch the locations of two adjacent Goal Tokens, or move one Goal Token to an adjacent location without a Goal Token.", cost: null, strength: 3, copies: 1},
    { label: "Horace Horsecollar", type: "Hero", description: "When Horace Horsecollar is played, you may move an Ally or Item to any location", cost: null, strength: 2, copies: 1},
    { label: "Mickey Mouse", type: "Hero", description: "Pete cannot complete Goals.", cost: null, strength: 5, copies: 1},
    { label: "Minnie Mouse", type: "Hero", description: "When Minnie Mouse is played, you may discard an Ally or Item from Pete's Realm.", cost: null, strength: 4, copies: 1},
    { label: "Oswald the Lucky Rabbit", type: "Hero", description: "The amount of Power that Pete gains from Play A Game is reduced by 1 power.", cost: null, strength: 2, copies: 1},
    { label: "Pluto", type: "Hero", description: "When Pluto is played, you may move an Item in Pete's Realm to Pluto's location.", cost: null, strength: 2, copies: 1},
    { label: "Tired", type: "Effect", description: "Pete loses half his Power, rounded down.", cost: null, strength: null, copies: 1},
    
  ],
};
