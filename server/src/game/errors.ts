//a refusal the player should see, as opposed to a bug
export class GameError extends Error {}

export function fail(message: string): never {
  throw new GameError(message);
}
