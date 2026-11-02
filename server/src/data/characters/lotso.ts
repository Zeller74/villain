import type { CharacterTemplate } from "../../types";

export const lotso: CharacterTemplate = {
  id: "lotso",
  name: "Lotso",
  locations: [
    { name: "Caterpillar Room", actions: ["discard", "play", "gain1",], topSlots: 0 },
    { name: "The Library", actions: ["fate", "gain2", "play", "activate"], topSlots: 2 },
    { name: "The Playground", actions: ["play", "discard", "fate", "gain3"], topSlots: 2 },
    { name: "Tricounty Landfill", actions: ["play", "vanquish", "play", "moveItemAlly"], topSlots: 2 },
  ],
  deck: [
    { label: "Locked Up", type: "Effect", description: "All Heroes in the Caterpillar Room get -1 Strength.", cost: 3, strength: null, copies: 3},
    { label: "Not Age Appropriate", type: "Effect", description: "Move any Hero in your Realm or any Buzz Lightyear to the Caterpillar Room.", cost: 2, strength: null, copies: 3},
    { label: "Something Snapped", type: "Condition", description: "During their turn, if another player discards one or more cards, you may play Something Snapped. Move all Heroes to the Caterpillar Room.", cost: null, strength: null, copies: 3},
    { label: "The Bookworm", type: "Effect", description: "Pay any amount of Power to play The Bookworm. Reduce a Hero's Strength by that amount.", cost: 0, strength: 0, copies: 3},
    { label: "Welcome to Sunnyside", type: "Effect", description: "Reveal from the top of your Fate deck until you reveal a Hero. Play that Hero to the Caterpillar Room. Discard the rest.", cost: 2, strength: null, copies: 3},
    { label: "Original Factory Settings", type: "Effect", description: "Flip Buzz Lightyear to Demo Mode Buzz Lightyear and move him to any location at the bottom of Lotso's Realm. All Heroes lose 1 Strength.", cost: 2, strength: null, copies: 2},
    { label: "Patrolling All Night Long", type: "Effect", description: "Choose a Hero who is not at the Caterpillar room. That Hero gets -1 Strength.", cost: 2, strength: null, copies: 2},
    { label: "Smells Like Strawberries", type: "Condition", description: "During their turn, if another player takes a Fate action, you may play Smells like Strawberries. Shuffle your discard pile back into your deck.", cost: null, strength: null, copies: 2},
    { label: "Where's Your Kid Now?", type: "Condition", description: "During their turn, if another player defeats a Hero with a Strength of 2 or more, you may play Where's Your Kid Now?. Choose a Hero at Lotso's location and reduce their Strength to 0.", cost: null, strength: null, copies: 2},
    { label: "Big Baby", type: "Ally", description: "Activate: Reveal cards from the top of your Fate deck until you reveal a Hero. Play that Hero to any location except the Caterpillar Room.", cost: 3, strength: 3, copies: 1},
    { label: "Chunk", type: "Ally", description: "Chunk gets +1 Strength if Sparks is in Lotso's Realm", cost: 1, strength: 1, copies: 1},
    { label: "New Toys Don't Stand a Chance", type: "Effect", description: "All Heroes in the Caterpillar Room lose Strength equal to the number of Heroes in the Caterpillar Room.", cost: 4, strength: null, copies: 1},
    { label: "Sparks", type: "Ally", description: "Sparks gets +1 Strength if Twitch is in Lotso's Realm.", cost: 1, strength: 1, copies: 1},
    { label: "Stretch", type: "Ally", description: "Activate: Move a Hero or Guardian in Stretch's location to any location in Lotso's Realm.", cost: 2, strength: 2, copies: 1},
    { label: "Twitch", type: "Ally", description: "Twitch gets +1 Strength if Chunk is in Lotso's Realm.", cost: 1, strength: 2, copies: 1},
    { label: "Woody's Hat", type: "Item", description: "All Heroes in Lotso's Realm except Woody get -1 Strength.", cost: 2, strength: null, copies: 1},
    
  ],
  fateDeck: [
    { label: "Bonnie's Toys", type: "Effect", description: "Choose a Hero with reduced Strength and remove all Strength reduction tokens from that Hero,", cost: null, strength: null, copies: 2},
    { label: "One Way Out", type: "Effect", description: "Move a Hero in the Caterpillar Room to any other location.", cost: null, strength: null, copies: 2},
    { label: "The Claw", type: "Effect", description: "Choose a Hero with 0 Strength in Lotso's Realm. Discard that Hero, removing all Strength tokens, then shuffle Lotso's Fate discard pile back into his Fate deck.", cost: null, strength: null, copies: 2},
    { label: "Spanish Mode", type: "Effect", description: "Flip Buzz Lightyear to his Guardian side and move him to the top of Lotso's Realm at The Playground. If Jessie is in Lotso's Realm, she gains 1 Strength.", cost: null, strength: null, copies: 1},
    { label: "Spanish Mode", type: "Effect", description: "Flip Buzz Lightyear to his Guardian side and move him to the top of Lotso's Realm at Tricounty Landfill. If Jessie is in Lotso's Realm, she gains 1 Strength.", cost: null, strength: null, copies: 1},
    { label: "Andy's Looking For Us", type: "Effect", description: "All Heroes with 1 or more Strength get +2 Strength. Heroes with 0 Strength are not affected.", cost: null, strength: null, copies: 1},
    { label: "Daisy's Locket", type: "Effect", description: "When Daisy's Locket is played, discard Big Baby. Shuffle Lotso's Fate discard pile into his Fate deck.", cost: null, strength: null, copies: 1},
    { label: "Hamm", type: "Hero", description: "When performing a Vanquish action to defeat Hamm, at least two Allies must be used.", cost: null, strength: 2, copies: 1},
    { label: "Jessie", type: "Hero", description: "When Jessie is played, you may discard any Ally from Lotso's Realm.", cost: null, strength: 3, copies: 1},
    { label: "Lotso was Special", type: "Effect", description: "Discard an Ally from Lotso's Realm.", cost: null, strength: null, copies: 1},
    { label: "Rex", type: "Hero", description: "When performing a Vanquish action, Rex cannot be targeted if there are other Heroes in his location. Rex cannot lose Strength if other Heroes are in his location.", cost: null, strength: 1, copies: 1},
    { label: "Woody", type: "Hero", description: "When Woody is played, you may move all Heroes in the Caterpillar Room to any other location. If Woody's Hat is in Lotso's Realm, discard it.", cost: null, strength: 5, copies: 1},
    
  ],
};
