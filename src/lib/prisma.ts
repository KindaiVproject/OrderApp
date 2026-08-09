import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getClient() {
  if (!globalThis.__prisma) {
    globalThis.__prisma = createClient();
  }
  return globalThis.__prisma;
}

// Lazy: the client (and its "DATABASE_URL is not set" check) is only
// constructed on first actual use, not at module import time — Next.js
// imports every route module while collecting build-time page data, which
// would otherwise fail the build whenever DATABASE_URL isn't available in
// that environment (e.g. a `next build` run without prod env vars loaded).
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver);
  },
});
