// Migrated to Prisma. See prisma/schema.prisma
export {};

  password: string;
  phone: string;
  location: string;
  category: string;
  rating: number;
  menu: mongoose.Types.ObjectId[];
  totalOrders: number;
  totalEarnings: number;
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const hotelSchema = new Schema<IHotel>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, default: "Fast Food" },
    rating: { type: Number, default: 4.5, min: 1, max: 5 },
    menu: [{ type: mongoose.Schema.Types.ObjectId, ref: "MenuItem" }],
    totalOrders: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    isOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Hotel = (mongoose.models.Hotel as mongoose.Model<IHotel>) || mongoose.model<IHotel>("Hotel", hotelSchema);
