// Migrated to Prisma. See prisma/schema.prisma
export {};

  phone: string;
  password: string;
  isOnline: boolean;
  isAvailable: boolean;
  currentOrders: mongoose.Types.ObjectId[];
  totalEarnings: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const riderSchema = new Schema<IRider>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },
    isOnline: { type: Boolean, default: false },
    isAvailable: { type: Boolean, default: false },
    currentOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],
    totalEarnings: { type: Number, default: 0 },
    rating: { type: Number, default: 5, min: 1, max: 5 },
  },
  { timestamps: true }
);

export const Rider = (mongoose.models.Rider as mongoose.Model<IRider>) || mongoose.model<IRider>("Rider", riderSchema);
