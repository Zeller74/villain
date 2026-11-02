import type { CharacterTemplate } from "../../types";

export const lady: CharacterTemplate = {
  id: "lady",
  name: "Lady Tremaine",
  locations: [
    { name: "Cinderella's Room", actions: ["play", "moveItemAlly", "discard", "gain3"], topSlots: 2 },
    { name: "The Music Room", actions: ["fate", "gain2", "play", "play"], topSlots: 2 },
    { name: "The Castle", actions: ["play", "discard", "fate", "gain1"], topSlots: 2 },
    { name: "The Ballroom", actions: ["activate", "play", "moveItemAlly"], topSlots: 0 },
  ],
  deck: [
    { label: "There's Still a Chance", type: "Effect", description: "Choose one: Move Item/Ally or Activate", cost: 2, strength: null, copies: 4},
    { label: "I Said 'If'", type: "Effect", description: "Shuffle your Villain discard pile back into your deck. Draw two cards.", cost: 2, strength: null, copies: 3},
    { label: "Trapped", type: "Effect", description: "Place a Trapped Token on a Hero in your Realm", cost: 1, strength: null, copies: 3},
    { label: "And One More Thing", type: "Condition", description: "During their turn, if another player takes a Discard action, you may play And One More Thing. You may discard any number of cards and draw back up to four cards.", cost: null, strength: null, copies: 2},
    { label: "I Never Go Back on My Word", type: "Effect", description: "Shuffle your Fate discard pile back into your Fate deck. Look at the top four Fate cards and replace them in any order.", cost: 2, strength: null, copies: 2},
    { label: "Locked Up", type: "Condition", description: "During their turn, if another player takes a Vanquish action, you may play Locked Up. You may place a Trapped Token on any Hero in your Realm.", cost: null, strength: null, copies: 2},
    { label: "Vicious Practical Jokes", type: "Condition", description: "During their turn, if another player targets you with a Fate action, you may play Vicious Practical Jokes. Of the two Fate cards chosen, you pick which card is played and where.", cost: null, strength: null, copies: 2},
    { label: "You Little Thief!", type: "Effect", description: "Defeat Cinderella or Ball Gown Cinderella", cost: 0, strength: null, copies: 2},
    { label: "Anastasia", type: "Ally", description: "Discard Anastasia from your Realm to play Ball Gown Anastasia. Anastasia may not be played if Ball Gown Anastasia is in play.", cost: 1, strength: 1, copies: 1},
    { label: "Ball Gown Anastasia", type: "Ally", description: "You must discard Anastasia from your Realm to play Ball Gown Anastasia.", cost: 2, strength: 2, copies: 1},
    { label: "Ball Gown Drizella", type: "Ally", description: "You must discard Drizella from your Realm to play Ball Gown Drizella.", cost: 2, strength: 2, copies: 1},
    { label: "Drizella", type: "Ally", description: "Discard Drizella from your Realm to play Ball Gown Drizella. Drizella may not be played if Ball Gown Drizella is in play.", cost: 1, strength: 1, copies: 1},
    { label: "Invitation From The King", type: "Item", description: "When Invitation From The King is played, unlock The Ballroom. If The Prince is not in play, find and play him to The Ballroom. Activate: Look at the top two cards of your Fate deck. Discard one and leave the other face down on top.", cost: 3, strength: null, copies: 1},
    { label: "Lady Tremaine's Cane", type: "Item", description: "Activate: Remove a Glass Slipper", cost: 2, strength: null, copies: 1},
    { label: "Lucifer", type: "Ally", description: "Place a Trapped Token on a Hero in Lucifer's location.", cost: 3, strength: 3, copies: 1},
    { label: "Midnight", type: "Effect", description: "Defeat All Heroes in your Realm. Find and play both Glass Slippers.", cost: 4, strength: null, copies: 1},
    { label: "The Key", type: "Item", description: "When The Key is played, move Cinderella to Cinderella's Room. Put a Trapped Token on her. Activate: Move any Hero to Cinderella's Room and put a Trapped Token on them.", cost: 2, strength: null, copies: 1},
    { label: "Wedding Bells", type: "Item", description: "Activate: Can only be Activated when The Prince and either Ball Gown Anastasia or Ball Gown Drizella are in The Ballroom and no Glass Slippers are in play. Activate this card to win the game!", cost: 4, strength: null, copies: 1},
    
  ],
  fateDeck: [
    { label: "Bibbidi-Bobbidi-Boo", type: "Effect", description: "Remove a Trapped Token from any Hero, then move that Hero to a new location.", cost: null, strength: null, copies: 3},
    { label: "Sweet Nightingale", type: "Effect", description: "Move an Ally to any location.", cost: null, strength: null, copies: 3},
    { label: "Glass Slipper", type: "Item", description: "This Glass Slipper does not attach to a Hero and must be played to Cinderella's Room. Lady Tremaine cannot win the game while a Glass Slipper is in her Realm.", cost: null, strength: null, copies: 1, art: "glass-slipper-cinderellas-room"},
    { label: "Glass Slipper", type: "Item", description: "This Glass Slipper does not attach to a Hero and must be played to The Castle. Lady Tremaine cannot win the game while a Glass Slipper is in her Realm.", cost: null, strength: null, copies: 1, art: "glass-slipper-the-castle"},
    { label: "Ball Gown Cinderella", type: "Hero", description: "Discard Cinderella to play Ball Gown Cinderella. While Ball Gown Cinderella is in play, no Allies may enter The Ballroom. This card cannot be Trapped. When Ball Gown Cinderella is defeated, find both Glass Slippers and play them.", cost: null, strength: 2, copies: 1},
    { label: "Bruno", type: "Hero", description: "When Bruno is played or moved, move Lucifer to his location.", cost: null, strength: 3, copies: 1},
    { label: "Cinderella", type: "Hero", description: "While Cinderella is in play, all Effect cards cost +2 Power. Cinderella may not be played if Ball Gown Cinderella is in play.", cost: null, strength: 2, copies: 1},
    { label: "Fairy Godmother", type: "Hero", description: "When Fairy Godmother is played, find and play Ball Gown Cinderella. While Fairy Godmother is in play, only Fate cards can move Allies.", cost: null, strength: 4, copies: 1},
    { label: "Gus", type: "Hero", description: "While Gus is in play, all Item cards cost +2 Power.", cost: null, strength: 1, copies: 1},
    { label: "Jaq", type: "Hero", description: "When Jaq is played or moved, discard one Item from his new location.", cost: null, strength: 1, copies: 1},
    { label: "The Prince", type: "Prince", description: "When The Prince is revealed, you MUST PLAY HIM IMMEDIATELY to The Ballroom, even if it is locked.", cost: null, strength: null, copies: 1, ignoresLock: true},
    
  ],
};
