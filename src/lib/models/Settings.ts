import mongoose, { Schema, Document } from "mongoose";

export interface ISite extends Document {
  name: string;
  address?: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

const SiteSchema = new Schema<ISite>(
  {
    name: { type: String, required: true, unique: true },
    address: String,
    timezone: { type: String, default: "Asia/Jakarta" },
  },
  { timestamps: true }
);

export const Site = mongoose.models.Site || mongoose.model<ISite>("Site", SiteSchema);

export interface ISLA extends Document {
  name: string;
  description?: string;
  duration: number;
  businessHours: {
    days: number[];
    startHour: number;
    endHour: number;
  };
  holidays: string[];
  escalation: {
    percentage: number;
    notifyRoles: string[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const SLASchema = new Schema<ISLA>(
  {
    name: { type: String, required: true },
    description: String,
    duration: { type: Number, required: true },
    businessHours: {
      days: { type: [Number], default: [1, 2, 3, 4, 5] },
      startHour: { type: Number, default: 8 },
      endHour: { type: Number, default: 17 },
    },
    holidays: [String],
    escalation: [
      {
        percentage: { type: Number, required: true },
        notifyRoles: [String],
      },
    ],
  },
  { timestamps: true }
);

export const SLA = mongoose.models.SLA || mongoose.model<ISLA>("SLA", SLASchema);

export interface ISettings extends Document {
  key: string;
  value: unknown;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Settings = mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);

export interface IDashboard extends Document {
  /** Owner for custom dashboards; null/undefined for system dashboards */
  userId?: mongoose.Types.ObjectId | null;
  /** Stable key: general | admin | custom ObjectId string */
  key: string;
  name: string;
  /** system = built-in; user = user-created */
  scope: "system" | "user";
  /** Who can see: all | superadmin | Requester | Technician | ... */
  audience: string;
  isDefault: boolean;
  /** System “favorite” dashboard (General) — default for all user types */
  isSystemFavorite?: boolean;
  widgets: {
    id: string;
    type: string;
    title: string;
    dataSource: string;
    chartType?: string;
    filters?: Record<string, unknown>;
    position: { x: number; y: number; w: number; h: number };
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardSchema = new Schema<IDashboard>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    key: { type: String, required: true },
    name: { type: String, required: true },
    scope: { type: String, enum: ["system", "user"], default: "user" },
    audience: { type: String, default: "all" },
    isDefault: { type: Boolean, default: false },
    isSystemFavorite: { type: Boolean, default: false },
    widgets: [
      {
        id: String,
        type: { type: String },
        title: String,
        dataSource: String,
        chartType: String,
        filters: Schema.Types.Mixed,
        position: {
          x: Number,
          y: Number,
          w: Number,
          h: Number,
        },
      },
    ],
  },
  { timestamps: true }
);

DashboardSchema.index({ userId: 1 });
DashboardSchema.index({ key: 1 }, { unique: true, sparse: true });

export const Dashboard = mongoose.models.Dashboard || mongoose.model<IDashboard>("Dashboard", DashboardSchema);

export interface ITicketTemplate extends Document {
  name: string;
  category: string;
  subCategory?: string;
  description?: string;
  needApproval: boolean;
  defaultFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TicketTemplateSchema = new Schema<ITicketTemplate>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    subCategory: String,
    description: String,
    needApproval: { type: Boolean, default: false },
    defaultFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const TicketTemplate =
  mongoose.models.TicketTemplate ||
  mongoose.model<ITicketTemplate>("TicketTemplate", TicketTemplateSchema);
