// Migrated to Prisma. See prisma/schema.prisma
export {};

  price: number;
  category: string;
  hotelId: mongoose.Types.ObjectId;
  image?: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const menuItemSchema = new Schema<IMenuItem>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    category: { type: String, default: "Main Course" },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    image: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const MenuItem = (mongoose.models.MenuItem as mongoose.Model<IMenuItem>) || mongoose.model<IMenuItem>("MenuItem", menuItemSchema);
