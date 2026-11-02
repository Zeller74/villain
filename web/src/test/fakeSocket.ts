import { act } from "@testing-library/react";

type Listener = (...args: unknown[]) => void;
type Sent = { event: string; payload: unknown; ack?: (res: unknown) => void };

//stands in for socket.io so a test can play the server's side of the conversation
export class FakeSocket {
  connected = true;
  sent: Sent[] = [];
  private listeners = new Map<string, Listener[]>();

  on(event: string, listener: (...args: never[]) => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as Listener);
    this.listeners.set(event, list);
  }

  emit(event: string, payload: unknown, ack?: (res: unknown) => void) {
    this.sent.push({event, payload, ack});
  }

  connect() {}
  close() {}

  receive(event: string, ...args: unknown[]) {
    act(() => this.listeners.get(event)?.forEach(fn => fn(...args)));
  }

  sentOf(event: string) {
    return this.sent.filter(s => s.event === event);
  }

  reply(event: string, res: unknown) {
    const last = this.sentOf(event).at(-1);
    if (!last) throw new Error(`nothing sent for ${event}`);
    act(() => last.ack?.(res));
  }
}
