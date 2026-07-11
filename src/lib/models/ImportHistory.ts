import mongoose, { Schema, Document } from "mongoose";

export interface IImportFailure {
  row: number;
  data?: Record<string, unknown>;
  error: string;
}

export interface IImportHistory extends Document {
  type: "users" | "assets" | "departments";
  fileName: string;
  importedBy?: mongoose.Types.ObjectId;
  importedByName: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    failed: number;
  };
  failures: IImportFailure[];
  /** Optional full per-row results for audit */
  results?: { row: number; status: string; error?: string; key?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const FailureSchema = new Schema<IImportFailure>(
  {
    row: { type: Number, required: true },
    data: { type: Schema.Types.Mixed },
    error: { type: String, required: true },
  },
  { _id: false }
);

const ImportHistorySchema = new Schema<IImportHistory>(
  {
    type: { type: String, enum: ["users", "assets", "departments"], required: true, index: true },
    fileName: { type: String, required: true },
    importedBy: { type: Schema.Types.ObjectId, ref: "User" },
    importedByName: { type: String, required: true },
    summary: {
      total: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    failures: { type: [FailureSchema], default: [] },
    results: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

ImportHistorySchema.index({ type: 1, createdAt: -1 });

export default mongoose.models.ImportHistory ||
  mongoose.model<IImportHistory>("ImportHistory", ImportHistorySchema);
