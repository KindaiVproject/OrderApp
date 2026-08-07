import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  // DATABASE_URL is resolved relative to the project root, same as the
  // Prisma CLI does when reading it from prisma.config.ts.
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const file = url.replace(/^file:/, "");
  const absolutePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), file);
  const adapter = new PrismaBetterSqlite3({ url: `file:${absolutePath}` });
  return new PrismaClient({ adapter });
}

export const prisma = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
