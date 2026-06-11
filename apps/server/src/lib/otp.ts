import bcrypt from 'bcryptjs';

/** Generate a zero-padded 6-digit numeric code. */
export function generateCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export const MAX_OTP_ATTEMPTS = 5;
