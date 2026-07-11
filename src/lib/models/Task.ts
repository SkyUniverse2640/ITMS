import mongoose, { Schema, Document } from "mongoose";

export interface ITask extends Document {
  title: string;
  description?: string;
  relatedTicket?: mongoose.Types.ObjectId;
  assignee: mongoose.Types.ObjectId;
  dueDate?: Date;
  status: "To Do" | "In Progress" | "Done";
  priority: string;
  checklist: { item: string; done: boolean }[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: String,
    relatedTicket: { type: Schema.Types.ObjectId, ref: "Ticket" },
    assignee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: Date,
    status: {
      type: String,
      enum: ["To Do", "In Progress", "Done"],
      default: "To Do",
    },
    priority: { type: String, default: "Normal" },
    checklist: [
      {
        item: { type: String, required: true },
        done: { type: Boolean, default: false },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TaskSchema.index({ assignee: 1, status: 1 });
TaskSchema.index({ relatedTicket: 1 });

export default mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);
