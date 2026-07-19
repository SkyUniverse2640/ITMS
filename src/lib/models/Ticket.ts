import mongoose, { Schema, Document } from "mongoose";

export interface IComment {
  _id?: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  content: string;
  isPrivate: boolean;
  attachments: string[];
  createdAt: Date;
}

/** Activity log entry shown on ticket detail → Logs */
export interface ITicketLog {
  _id?: mongoose.Types.ObjectId;
  actor?: mongoose.Types.ObjectId;
  actorName: string;
  actorEmail?: string;
  action: string;
  message: string;
  fromStatus?: string;
  toStatus?: string;
  createdAt?: Date;
}

export interface ITicket extends Document {
  ticketNumber: string;
  requestType: string;
  status: string;
  impact: string;
  urgency: string;
  priority: string;
  /** @deprecated Prefer department — kept for legacy tickets */
  group: string;
  /** Handling department (replaces Group routing) */
  department?: string;
  category?: string;
  subCategory?: string;
  project?: string;
  requester: mongoose.Types.ObjectId;
  requesterName: string;
  requesterEmail: string;
  relatedAssets: mongoose.Types.ObjectId[];
  technician?: mongoose.Types.ObjectId;
  subject: string;
  description: string;
  attachments: string[];
  approver?: mongoose.Types.ObjectId;
  /** Department hierarchy label used for approval (Director | Manager | Supervisor) */
  approvalLabel?: string;
  approvalStatus?: "Pending" | "Approved" | "Rejected";
  closureCode?: string;
  resolutionNotes?: string;
  resolvedAt?: Date;
  closedAt?: Date;
  reopenedAt?: Date;
  slaBreached: boolean;
  slaDueAt?: Date;
  slaRespondDueAt?: Date;
  slaRespondBreached: boolean;
  slaRespondedAt?: Date;
  slaConfig?: mongoose.Types.ObjectId;
  comments: IComment[];
  logs: ITicketLog[];
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    isPrivate: { type: Boolean, default: false },
    attachments: [String],
  },
  { timestamps: true }
);

const TicketLogSchema = new Schema<ITicketLog>(
  {
    // No ref: "User" — avoid StrictPopulateError on logs.actor (name/email denormalized)
    actor: { type: Schema.Types.ObjectId },
    actorName: { type: String, required: true },
    actorEmail: String,
    action: { type: String, required: true },
    message: { type: String, required: true },
    fromStatus: String,
    toStatus: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const TicketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    requestType: { type: String, default: "Incident" },
    status: { type: String, default: "Open" },
    impact: { type: String, default: "Normal" },
    urgency: { type: String, default: "Normal" },
    priority: { type: String, default: "Normal" },
    group: { type: String, default: "IT" },
    department: { type: String, default: "IT" },
    category: String,
    subCategory: String,
    project: String,
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },
    relatedAssets: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
    technician: { type: Schema.Types.ObjectId, ref: "User" },
    subject: { type: String, required: true },
    description: { type: String, default: "" },
    attachments: [String],
    approver: { type: Schema.Types.ObjectId, ref: "User" },
    approvalLabel: String,
    approvalStatus: { type: String, enum: ["Pending", "Approved", "Rejected"] },
    closureCode: String,
    resolutionNotes: String,
    resolvedAt: Date,
    closedAt: Date,
    reopenedAt: Date,
    slaBreached: { type: Boolean, default: false },
    slaDueAt: Date,
    slaRespondDueAt: Date,
    slaRespondBreached: { type: Boolean, default: false },
    slaRespondedAt: Date,
    slaConfig: { type: Schema.Types.ObjectId, ref: "SLA" },
    comments: [CommentSchema],
    logs: {
      type: [TicketLogSchema],
      default: [],
    },
  },
  { timestamps: true }
);

TicketSchema.index({ requester: 1 });
TicketSchema.index({ technician: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ priority: 1 });
TicketSchema.index({ createdAt: -1 });
TicketSchema.index({ approver: 1 });

/**
 * Next.js / turbopack HMR keeps mongoose.models.Ticket from first compile.
 * Always drop & recompile so `logs` (and nested actor) stay in schema.
 */
const TICKET_MODEL = "Ticket";
if (mongoose.models[TICKET_MODEL]) {
  delete mongoose.models[TICKET_MODEL];
}
export default mongoose.model<ITicket>(TICKET_MODEL, TicketSchema);
