// Migrated to Prisma. See prisma/schema.prisma
export {};

  | "Preparing"
  | "Ready"
  | "Out for Delivery"
  | "Delivered"
  | "Cancelled";

export interface IOrderItem {
  menuItemId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  hotelId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalPrice: number;
  status: OrderStatus;
  riderId?: mongoose.Types.ObjectId;
  deliveryAddress: string;
  paymentMethod: "COD" | "Card";
  customerPhone: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    items: [
      {
        menuItemId: mongoose.Schema.Types.ObjectId,
        name: String,
        price: Number,
        quantity: Number,
      },
    ],
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "Placed",
        "Accepted",
        "Preparing",
        "Ready",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
      ],
      default: "Placed",
    },
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "Rider" },
    deliveryAddress: { type: String, required: true },
    paymentMethod: { type: String, enum: ["COD", "Card"], default: "COD" },
    customerPhone: { type: String, required: true },
  },
  { timestamps: true }
);

export const Order = (mongoose.models.Order as mongoose.Model<IOrder>) || mongoose.model<IOrder>("Order", orderSchema);
