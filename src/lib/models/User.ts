import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  displayName: string;
  username: string;
  password: string;
  role: "SuperAdmin" | "User";
  userTypes: string[];
  jobTitle?: string;
  department?: string;
  employeeId: string;
  mobile?: string;
  email: string;
  site?: mongoose.Types.ObjectId;
  status: "Active" | "Inactive";
  lastLogin?: Date;
  mustChangePassword: boolean;
  /** Preferred dashboard key: "general" | "admin" | custom id */
  defaultDashboardKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    displayName: { type: String, required: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["SuperAdmin", "User"], default: "User" },
    userTypes: [{ type: String }],
    jobTitle: String,
    department: String,
    employeeId: { type: String, required: true, unique: true },
    mobile: String,
    email: { type: String, required: true, unique: true, lowercase: true },
    site: { type: Schema.Types.ObjectId, ref: "Site" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    lastLogin: Date,
    mustChangePassword: { type: Boolean, default: false },
    defaultDashboardKey: { type: String, default: "general" },
  },
  { timestamps: true }
);

UserSchema.index({ role: 1, status: 1 });

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
