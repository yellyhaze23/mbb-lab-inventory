import bcrypt from "npm:bcryptjs@2.4.3";

export function normalizePin(pin: unknown): string | null {
  if (typeof pin !== "string") return null;
  const trimmed = pin.trim();
  if (!/^\d{4,10}$/.test(trimmed)) return null;
  return trimmed;
}

export function verifyPinHash(pin: string, hash: string): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(pin, hash);
}
