import { hash, verify } from '@node-rs/argon2';

// Parámetros argon2id recomendados por OWASP (m=19 MiB, t=2, p=1).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (plain: string): Promise<string> => hash(plain, OPTIONS);

export const verifyPassword = (hashed: string, plain: string): Promise<boolean> =>
  verify(hashed, plain).catch(() => false);
