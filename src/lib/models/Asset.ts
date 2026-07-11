import mongoose, { Schema, Document } from "mongoose";

export interface IAsset extends Document {
  name: string;
  assetType: string;
  assetCategory: "Hardware" | "Software" | "Consumable";
  assetTag: string;
  serialNumber?: string;
  vendor?: string;
  purchaseCost?: number;
  purchaseDate?: Date;
  expiredDate?: Date;
  warrantyExpiredDate?: Date;
  currentState: string;
  assignedTo?: mongoose.Types.ObjectId;
  department?: string;
  site?: mongoose.Types.ObjectId;
  comment?: string;
  licenseKey?: string;
  totalSeats?: number;
  seatsUsed?: number;
  stockQuantity?: number;
  reorderThreshold?: number;
  unit?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true },
    assetType: { type: String, required: true },
    assetCategory: {
      type: String,
      enum: ["Hardware", "Software", "Consumable"],
      required: true,
    },
    assetTag: { type: String, required: true, unique: true },
    serialNumber: String,
    vendor: String,
    purchaseCost: Number,
    purchaseDate: Date,
    expiredDate: Date,
    warrantyExpiredDate: Date,
    currentState: { type: String, default: "In Warehouse" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    department: String,
    site: { type: Schema.Types.ObjectId, ref: "Site" },
    comment: String,
    licenseKey: String,
    totalSeats: Number,
    seatsUsed: { type: Number, default: 0 },
    stockQuantity: Number,
    reorderThreshold: Number,
    unit: String,
  },
  { timestamps: true }
);

AssetSchema.index({ assignedTo: 1 });
AssetSchema.index({ currentState: 1 });
AssetSchema.index({ assetCategory: 1 });

export default mongoose.models.Asset || mongoose.model<IAsset>("Asset", AssetSchema);
