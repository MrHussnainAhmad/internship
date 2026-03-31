import { ObjectId } from "mongodb";

const HEX = "0123456789abcdef";
const SAFE = "qrstuvwxyzabcdef";

function encodeHexNibble(char: string) {
  const index = HEX.indexOf(char);
  return index >= 0 ? SAFE[index] : "";
}

function decodeSafeNibble(char: string) {
  const index = SAFE.indexOf(char);
  return index >= 0 ? HEX[index] : "";
}

export function toPublicPostId(objectId: string) {
  if (!ObjectId.isValid(objectId)) return objectId;
  const normalized = objectId.toLowerCase();
  let token = "";
  for (const char of normalized) {
    token += encodeHexNibble(char);
  }
  return token;
}

export function toObjectIdFromPublicPostId(input: string) {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  if (ObjectId.isValid(raw)) {
    return raw;
  }

  if (raw.length !== 24) return null;
  let decoded = "";
  for (const char of raw) {
    const nibble = decodeSafeNibble(char);
    if (!nibble) return null;
    decoded += nibble;
  }
  if (!ObjectId.isValid(decoded)) return null;
  return decoded;
}
