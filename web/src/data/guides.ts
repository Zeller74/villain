export type GuideEntry = { title: string; image: string; body: string};
export const GUIDES: Record<string, GuideEntry> = {
  maleficent: {
    title: "Maleficent - Villain Guide",
    image: "/guides/maleficent.jpg",
    body: `Maleficent's Objective: Start your turn with a Curse at each location.
Curses: Curse is a card type unique to Maleficent. Curses are played to locations, and each one has an Ability that affects Heroes at that location. However, each Curse also has an action that will cause it to be discarded. So you'll need to strategize when and where to play each curse.
Multiple curses may be played to the same location, and a Curse may be moved using a Move an Item or Ally action. The three Curses are Forest of Thorns, Green Fire, and Dreamless Sleep.

Forest of Thorns: Forest of Thorns makes it difficult for opponents to play a Hero at its location because a Hero must have a Strength of 4 or more to be played there.

Green Fire: Green Fire is a very powerful Curse because Heroes cannot be played to its location.

Dreamless Sleep: Dreamless Sleep reduces the Strengths of all Heroes at its location by 2.
Note: You may move an Ally to a location without having to discard the Curse. Also, you can play Dreamless Sleep to a location that already has Allies without affecting the Allies or the Curse.

Other Cards: Vanish allows Maleficent to remain at a location, enabling her to take the same action two turns in a row. Raven is a powerful Ally to play as early as possible. At the start of each turn, you may move Raven and perform one action that is available at his new location.`,
  },
  captain: {
    title: "Captain Hook - Villain Guide",
    image: "/guides/captain.jpg",
    body: `Captain Hook's Objective: Defeat Peter Pan at the Jolly Roger.
In order to achieve this objective, you must unlock the Hangman's Tree location by playing the Never Land Map. Peter Pan must be played, either by you or an opponent, to Hangman's Tree. You will then need to move him to Mermaid Lagoon, then to Skull Rock, and finally to the Jolly Roger, where you must defeat him to win the game.

Special Setup: Place a Lock Token on Hangman's Tree, as that location is locked at the beginning of the game.

Peter Pan: When Peter Pan is revealed, he must immediately be played to Hangman's Tree, even if Hangman's Tree is still locked. If Peter Pan is one of the two cards drawn by an opponent while performing a Fate action targeting you, the opponent must play Peter Pan and discard the other card.

Never Land Map: When you play the Never Land Map, unlock Hangman's Tree by removing the Lock Token from the location.
Important: Peter Pan may not be moved from Hangman's Tree until it is unlocked.

Controlling your Fate: Unlike other Villains, Captain Hook can play and discard cards from his own Fate deck using Worthy Opponent, Give Them a Scare, and Obsession. Using these cards will help you reveal Peter Pan and bring him into your Realm as soon as possible.

Extra Actions: Cannon, Hook's Case, and Ingenious Device are Items that add extra action symbols to your Realm. After the Item has been played to a location, you may perform the extra action in addition to the other available actions there.`,
  },
  prince: {
    title: "Prince John - Villain Guide",
    image: "/guides/prince.jpg",
    body: `Prince John's Objective: Start your turn with at least 20 Power.

Prince John is all about greed, so he needs to accumulate Power. However, as tempting as it might be to save all the Power you can, you will need to spend some Power in order to win. Several Heroes can hinder Prince John's ability to gain Power. It is a good idea to play Allies, even before any Heroes have been played. By doing so, you will be prepared to Vanquish a Hero that is affecting your progress.

The Jail: Prince John's Realm has a location that can be used to his advantage. The Jail does not have any action symbols that can be covered by Heroes, making Heroes at that location less disruptive. Prince John has Imprison cards which allow him to move Heroes to The Jail in order to make actions available elsewhere.

It's Good to Be the King! Although Heroes can be disruptive to his plans, Prince John has several tricks up his sleeve. Cards such as Warrant, Sheriff of Nottingham, and Beautiful, Lovely Taxes allow him to profit from having Heroes in his Realm. Sometimes it pays to keep your enemies close!

Special Fate Cards: When Steal from the Rich is played, 4 Power is taken from Prince John and placed on any one Hero that is in his Realm. When a Hero that has Power on them is defeated, Prince John takes all of the Power back.The same Hero may be used to Steal from the Rich multiple times, which can lead to a big payoff when the Hero is defeated!

While Robin Hood is in Prince John's Realm, every time Prince John gains Power due to an action or card, he gains 1 less Power than he would normally gain. It is usually a good idea to defeat Robin Hood as soon as possible!

When Little John is played, 4 Power is taken from Prince John and placed on Little John's card. When Little John is defeated, Prince John takes all of the Power back. Waiting for just the right time to defeat Little John can help set up an unexpected victory!`,
  },
  lady: {
    title: "Lady Tremaine - Villain Guide",
    image: "/guides/lady.jpg",
    body: `Lady Tremaine's Objective: Marry Drizella or Anastasia to the Prince.

To achieve Lady Tremaine's Objective, the Prince must be played from her Fate deck to The Ballroom, which must be unlocked by playing Invitation From the King, and you must move Ball Gown Anastasia to The Ballroom. While there, you must activate the Wedding Bells card.

Special Setup: Place a Lock Token on The Ballroom. This location is locked at the beginning of the game. Lady Tremaine cannot move to The Ballroom until it becomes unlocked.

Going to the Ball: Once The Ballroom is unlocked by playing Invitation From the King, The Ballroom cannot be re-locked.
Only four characters can be played or moved to The Ballroom: The Prince (who is played there immediately when revealed), Ball Gown Cinderella, Ball Gown Drizella, and Ball Gown Anastasia. While in play, Ball Gown Cinderella prevents Ball Gown Drizella or Ball Gown Anastasia from entering The Ballroom. This card has no effect if they are already there. Sweet Nightingale is a powerful Fate card that may slow your progress to The Ballroom by moving any Ally to a new location.
Ball Gown Cinderella, Ball Gown Drizella, and Ball Gown Anastasia can only be played by first playing Cinderella, Drizella, or Anastasia in their everyday dresses then discarding them to play their Ball Gown versions to the same location. This swap requires a Play a Card action. There can never be two versions of a character in play at the same time.
Important: Fairy Godmother can play Ball Gown Cinderella even if Cinderella is not in play. If this occurs, you may play Ball Gown Cinderella to any unlocked location.

Trapped!: Cards like Lucifer, The Key, and Trapped allow you to place a Trapped Token on a Hero in your Realm. When a Hero has a Trapped Token, their Ability is ignored, as if the card has no Ability at all. The card still remains in play and blocks your actions.
Ball Gown Cinderella cannot be Trapped by any card, although she can still be moved using the Activate action of The Key. Lady Tremaine has no Vanquish actions. However, players can use Activate actions to discard or defeat Fate cards from play. Cards such as Lady Tremaine's Cane, Midnight, and You Little Thief all remove specific Hero and Item cards from your Realm.

Glass Slippers: Unlike other Items in the Fate card deck, Glass Slippers do not attach to a Hero. You cannot win the game while a Glass Slipper is in your Realm. You can remove a Glass Slipper by Activating Lady Tremaine's Cane. Note: The Prince card is a Prince, not a Hero. The Prince is not affected by cards targeting Heroes.
`,
  },
  mother: {
    title: "Mother Gothel - Villain Guide",
    image: "/guides/mother.jpg",
    body: `Mother Gothel's Objective: Start your turn with at least 10 Trust.
    
Special Setup: Place the Rapunzel Tile at Rapunzel's Tower.

Trust: Mother Gothel wants to keep Rapunzel close, so she needs Rapunzel to trust her.

Rapunzel: Rapunzel is a unique Hero because she is already in your Realm at the start of the game, and she is never discarded. Like other Heroes, she blocks actions at her location and may be defeated by using a Vanquish action. However, when Rapunzel is defeated, instead of discarding her, move her to Rapunzel's Tower.
Important: At the end of Mother Gothel's turn, move Rapunzel one location toward Corona. If you cannot move Rapunzel because she is already at Corona, Mother Gothel loses 1 Trust.

Controlling Rapunzel: Mother Gothel is able to gain Trust easily when Rapunzel is at Rapunzel's Tower, and keeping her away from Corona is important. Mother Gothel has several ways she controls Rapunzel's location. Mother Knows Best prevents Rapunzel from moving toward Corona at the end of that turn. Patchy Stabbington and Sideburns Stabbington move Rapunzel to Rapunzel's Tower and are powerful Allies that can be used to defeat Heroes. Now I'm The Bad Guy moves Rapunzel to Rapunzel's Tower. Mother Gothel loses 1 Trust, but it might be helpful in combination with other actions. 

Gaining Trust: There are several cards that can gain Trust. When Hair Brush is played or moved to Rapunzel's location, gain 1 Trust. This item is good to play early as it can keep gaining Trust when it is in your Realm. I Love You Most gains 1 Trust if Mother Gothel is at Rapunzel's location. It is most effective when played at Rapunzel's Tower to gain an additional Trust. Let Down Your Hair can gain you Trust or move Rapunzel to help keep her away from Corona. Misdirection gains 1 Trust but moves Rapunzel toward Corona, so it should be used strategically to avoid losing Trust later. Crown can be used as a way to gain Power each time a Hero is defeated at that location. You can instead choose to discard Crown to gain 1 Trust. Revenge allows you to perform a Vanquish action and gain 1 Trust if a Hero other than Rapunzel is defeated.

Strategy Tips: Some cards are most effective if played when Rapunzel is at Rapunzel's Tower. Since Rapunzel will move toward Corona at the end of your turn, moving her to Rapunzel's Tower or keeping her there will allow you to gain more Trust from those cards. Playing Effect or Condition cards and using Allies to defeat Rapunzel can move her to Rapunzel's Tower.`,
  },
  lotso: {
    title: "Lotso - Villain Guide",
    image: "/guides/lotso.jpg",
    body: `Lotso's Objective: Have 4 Heroes with a Strength of 0 and Buzz Lightyear in the Caterpillar Room.
    
Special Setup: Place Buzz Lightyear at the top of Lotso's Realm in the Caterpillar Room with his Guardian side facing up.

Reducing Heroes' Strength: Lotso has two ways to reduce Heroes' Strength: with Vanquish actions and with cards. To reduce a Hero's Strength, add Strength modifier tokens to the card. Important: Unlike the normal rules, if a Hero in Lotso's Realm is at 0 Strength, they cannot use their ability. When Lotso Vanquishes a Hero, he does not discard them from his Realm. Instead, he reduces their Strength to 0 using Strength tokens. The Hero stays on Lotso's Realm where they are. Lotso still discards the Ally or Allies used in the Vanquish action.Lotso can also reduce Strength with specific cards.

The Caterpillar Room: Lotso has several ways to move Heroes to the Caterpillar Room and keep them there. Stretch and Welcome to Sunnyside move Heroes into the Caterpillar Room. These can be used at any time regardless of a Hero's Strength.

Controlling Lotso's Fate: Some Heroes are more difficult for Lotso to subdue. For example, Rex's Strength can only be reduced by cards or by a Vanquish action if he is the only Hero in a location. Hamm can only be Vanquished by two or more Allies.

Buzz Lightyear: Depending on his settings Buzz Lightyear can be either Lotso's Ally or a Guardian of Heroes.
Buzz Lightyear starts as a Guardian. He is not considered a Hero and cannot be targeted by Vanquish actions. Original Factory Settings flips Buzz Lightyear to Demo Mode Buzz Lightyear, Lotso's Ally. Flip over the tile and move Demo Mode Buzz Lightyear to the bottom of Lotso's Realm.

Demo Mode Buzz Lightyear cannot be discarded from Lotso's Realm. Cards targeting Allies, such as Jessie and Lotso Was Special, do not affect Demo Mode Buzz Lightyear. Spanish Mode can flip Buzz Lightyear back to his Guardian side. Flip over the tile and move it back to the top of Lotso's Realm.

Either Buzz Lightyear or Demo Mode Buzz Lightyear must be in the Caterpillar Room for Lotso to win.
`,
  },
};
