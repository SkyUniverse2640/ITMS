import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  actor: mongoose.Types.ObjectId;
  actorName: string;
  action: "Create" | "Update" | "Delete";
  module: "Ticket" | "Asset" | "User" | "Task" | "Purchase" | "Settings";
  targetId: string;
  targetLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    action: {
      type: String,
      enum: ["Create", "Update", "Delete"],
      required: true,
    },
    module: {
      type: String,
      enum: ["Ticket", "Asset", "User", "Task", "Purchase", "Settings"],
      required: true,
    },
    targetId: { type: String, required: true },
    targetLabel: { type: String, required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ipAddress: String,
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ module: 1, action: 1 });
AuditLogSchema.index({ actor: 1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
