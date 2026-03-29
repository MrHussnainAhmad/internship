import { MongoClient } from "mongodb";
import { requireEnv } from "@/lib/env";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = requireEnv("MONGODB_URI");

const client = new MongoClient(uri, {
  maxPoolSize: 20,
});

export const mongoClientPromise =
  global.__mongoClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  global.__mongoClientPromise = mongoClientPromise;
}

export async function getDb() {
  const resolvedClient = await mongoClientPromise;
  const dbName = requireEnv("MONGODB_DB_NAME", "internhub");
  return resolvedClient.db(dbName);
}
