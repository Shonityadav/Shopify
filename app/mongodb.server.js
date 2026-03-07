import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri) {
  throw new Error("Please add MONGODB_URI to your .env");
}

if (!dbName) {
  throw new Error("Please add MONGODB_DB_NAME to your .env");
}

let client;
let db;

export async function connectToDatabase() {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();

  db = client.db(dbName);

  console.log("✅ Connected to MongoDB Atlas");

  return db;
}