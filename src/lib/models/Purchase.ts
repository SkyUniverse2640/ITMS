import mongoose, { Schema, Document } from "mongoose";

export interface IPurchase extends Document {
  itemName: string;
  linkedAssetType?: string;
  quantity: number;
  estimatedCost: number;
  vendor?: string;
  justification?: string;
  requestedBy: mongoose.Types.ObjectId;
  approver?: mongoose.Types.ObjectId;
  status: "Draft" | "Pending Approval" | "Approved" | "Rejected" | "Completed";
  rejectionReason?: string;
  linkedAsset?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    itemName: { type: String, required: true },
    linkedAssetType: String,
    quantity: { type: Number, required: true, min: 1 },
    estimatedCost: { type: Number, required: true, min: 0 },
    vendor: String,
    justification: String,
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approver: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["Draft", "Pending Approval", "Approved", "Rejected", "Completed"],
      default: "Draft",
    },
    rejectionReason: String,
    linkedAsset: { type: Schema.Types.ObjectId, ref: "Asset" },
  },
  { timestamps: true }
);

PurchaseSchema.index({ requestedBy: 1 });
PurchaseSchema.index({ approver: 1, status: 1 });
PurchaseSchema.index({ status: 1 });

export default mongoose.models.Purchase || mongoose.model<IPurchase>("Purchase", PurchaseSchema);
