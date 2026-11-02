import { z } from "zod";
import type { EventName, Payload } from "../protocol";

const Id = z.string().trim().min(1).max(64);
const Name = z.string().trim().min(1).max(32);
const Loc = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
const Delta = (limit: number) => z.number().int().min(-limit).max(limit);
const Ids = z.array(Id).min(1).max(100);
const NoPayload = z.unknown();

//every client event is checked against its entry here before any game code runs
export const schemas = {
  "meta:getCharacters": NoPayload,

  "room:create": z.object({name: Name}),
  "room:join": z.object({roomId: Id, name: Name}),
  "room:resume": z.object({roomId: Id, token: Id}),
  "room:leave": NoPayload,
  "chat:send": z.object({text: z.string().trim().min(1).transform(s => s.slice(0, 300))}),

  "lobby:chooseCharacter": z.object({characterId: Id}),
  "lobby:setReady": z.object({ready: z.boolean()}),
  "lobby:start": NoPayload,

  "game:endTurn": NoPayload,
  "game:claimWin": NoPayload,
  "game:backToLobby": NoPayload,
  "game:draw": z.object({count: z.number().int().min(1).max(5).optional()}),
  "game:playToLocation": z.object({cardId: Id, locationIndex: Loc}),
  "game:playEffect": z.object({cardId: Id}),
  "game:discard": z.object({cardIds: Ids}),
  "game:moveCard": z.object({cardId: Id, from: Loc, to: Loc}),
  "game:removeCard": z.object({cardId: Id, from: Loc}),
  "game:reshuffleDeck": NoPayload,
  "reaction:end": NoPayload,

  "pile:getDiscard": z.object({playerId: Id}),
  "pile:takeFromDiscard": z.object({cardId: Id}),
  "log:undoSelf": NoPayload,

  "power:change": z.object({delta: Delta(10)}),
  "trust:change": z.object({delta: Delta(10)}),
  "pawn:set": z.object({to: Loc}),
  "card:deltaStrength": z.object({cardId: Id, delta: Delta(5)}),
  "board:toggleLocationLock": z.object({index: Loc, locked: z.boolean().optional()}),
  "board:toggleCardLock": z.object({cardId: Id, locked: z.boolean().optional()}),
  "board:moveTop": z.object({cardId: Id, from: Loc, to: Loc}),
  "board:discardTop": z.object({locationIndex: Loc, cardId: Id}),

  "fate:start": z.object({targetId: Id}),
  "fate:startFromDiscard": z.object({targetId: Id, cardId: Id}),
  "fate:choosePlay": z.object({cardId: Id}),
  "fate:placeSelected": z.object({locationIndex: Loc}),
  "fate:discardBoth": NoPayload,
  "fate:discardSelected": NoPayload,
  "fate:cancel": NoPayload,
  "fate:getDiscard": z.object({playerId: Id}),
  "fate:reshuffleDeck": z.object({playerId: Id}),
  "fateDiscard:return": z.object({playerId: Id, cardId: Id}),

  "fatePeek:start": z.object({targetId: Id, count: z.number().int().min(1).max(5), reshuffleFirst: z.boolean().optional()}),
  "fatePeek:confirm": z.object({orderIds: Ids}),
  "fatePeek:cancel": NoPayload,

  "fateSift:start": z.object({targetId: Id.optional()}),
  "fateSift:choose": z.object({discardId: Id}),
  "fateSift:cancel": NoPayload,

  "fateFindHero:start": z.object({targetId: Id}),

  "char:toggleHandReveal": NoPayload,
  "lotso:flipBuzz": NoPayload,
} satisfies {[E in EventName]: z.ZodType<Payload<E>>};
