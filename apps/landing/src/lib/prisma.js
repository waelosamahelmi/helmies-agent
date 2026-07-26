let _prisma = null;

function getPrisma() {
  if (_prisma) return _prisma;
  try {
    const { PrismaClient } = require("@prisma/client");
    if (process.env.DATABASE_URL) {
      try {
        const { PrismaPg } = require("@prisma/adapter-pg");
        const { Pool } = require("pg");
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const adapter = new PrismaPg(pool);
        _prisma = new PrismaClient({ adapter });
      } catch {
        _prisma = new PrismaClient();
      }
    } else {
      _prisma = new PrismaClient();
    }
  } catch (e) {
    // During build without DB, provide a mock that throws on use
    console.warn("Prisma unavailable:", e.message);
    _prisma = new Proxy({}, {
      get: () => { throw new Error("Database not available. Set DATABASE_URL to enable."); }
    });
  }
  return _prisma;
}

// Use a lazy getter pattern to avoid crash at import time
const handler = {
  get(_, prop) {
    const client = getPrisma();
    return typeof client[prop] === "function" ? client[prop].bind(client) : client[prop];
  }
};

const prisma = new Proxy({}, handler);

export default prisma;