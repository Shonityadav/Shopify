import { Session } from "@shopify/shopify-api";
import { connectToDatabase } from "./mongodb.server.js";

let sessionStorage;

export function getSessionStorage() {
  if (sessionStorage) return sessionStorage;

  sessionStorage = {
    async storeSession(session) {
      const db = await connectToDatabase();
      const sessions = db.collection("sessions");

      await sessions.updateOne(
        { id: session.id },
        { $set: session.toObject() }, // store as plain object
        { upsert: true }
      );

      return true;
    },

    async loadSession(id) {
      const db = await connectToDatabase();
      const sessions = db.collection("sessions");

      const data = await sessions.findOne({ id });

      if (!data) return undefined;

      // Recreate Shopify Session object
      return Session.fromPropertyArray(
        Object.entries(data).filter(([key]) => key !== "_id")
      );
    },

    async deleteSession(id) {
      const db = await connectToDatabase();
      const sessions = db.collection("sessions");

      await sessions.deleteOne({ id });
      return true;
    },

    async deleteSessions(ids) {
      const db = await connectToDatabase();
      const sessions = db.collection("sessions");

      await sessions.deleteMany({ id: { $in: ids } });
      return true;
    },
  };

  return sessionStorage;
}