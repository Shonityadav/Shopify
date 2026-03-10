import { connectToDatabase } from "../mongodb.server";

export async function createPass(data) {
  const db = await connectToDatabase();

  return db.collection("pass").insertOne({
    store: data.store,
    name: data.name,
    passType: data.passType || null,
    discountType: data.discountType || null,
    discountValue: data.discountValue || 0,
    applicableProducts: data.applicableProducts || [],
    passProductId: data.passProductId || null,
    expiryDate: data.expiryDate || null,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function getPass(store) {
  const db = await connectToDatabase();
  return db.collection("pass").find({ store }).toArray();
}

export async function getPassById(passId) {
  const db = await connectToDatabase();
  const { ObjectId } = await import("mongodb");
  return db.collection("pass").findOne({ _id: new ObjectId(passId) });
}

export async function updatePass(passId, data) {
  const db = await connectToDatabase();
  const { ObjectId } = await import("mongodb");

  return db.collection("pass").updateOne(
    { _id: new ObjectId(passId) },
    {
      $set: {
        name: data.name !== undefined ? data.name : undefined,
        passType: data.passType !== undefined ? data.passType : undefined,
        discountType: data.discountType !== undefined ? data.discountType : undefined,
        discountValue: data.discountValue !== undefined ? data.discountValue : undefined,
        applicableProducts: data.applicableProducts !== undefined ? data.applicableProducts : undefined,
        passProductId: data.passProductId !== undefined ? data.passProductId : undefined,
        expiryDate: data.expiryDate !== undefined ? data.expiryDate : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
        updatedAt: new Date(),
      },
    }
  );
}