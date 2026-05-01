/**
 * JSON codec helpers. The wire format is plain JSON; this module hides
 * the bigint-string conversion so callers can work with bigints natively.
 */
import { ClientToServer, ServerToClient, type ClientMessage, type ServerMessage } from './messages';

export function encodeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}

export function encodeClientMessage(msg: ClientMessage): string {
  return JSON.stringify(msg);
}

export function decodeServerMessage(raw: string): ServerMessage {
  return ServerToClient.parse(JSON.parse(raw));
}

export function decodeClientMessage(raw: string): ClientMessage {
  return ClientToServer.parse(JSON.parse(raw));
}

/** Convert a bigint cursor to its on-the-wire decimal string form. */
export function cursorToString(cursor: bigint): string {
  return cursor.toString(10);
}

/** Inverse of cursorToString; throws on malformed input. */
export function cursorFromString(s: string): bigint {
  if (!/^\d+$/.test(s)) throw new Error(`invalid cursor: ${s}`);
  return BigInt(s);
}
