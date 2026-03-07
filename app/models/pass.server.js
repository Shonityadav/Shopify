import mongoose from "mongoose";

const passSchema = new mongoose.Schema({
  store: String,
  name: String,
  passType: String,
  discountType: String,
  discountValue: Number,
  applicableProducts: [String],
  passProductId: String,
  expiryDate: Date,
  isActive: Boolean,
}, { timestamps: true });

export default mongoose.models.Pass || mongoose.model("Pass", passSchema);