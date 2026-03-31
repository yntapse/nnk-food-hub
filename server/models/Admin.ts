// Migrated to Prisma. See prisma/schema.prisma
export {};

  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, default: "Admin" },
  },
  { timestamps: true }
);

export const Admin = (mongoose.models.Admin as mongoose.Model<IAdmin>) || mongoose.model<IAdmin>("Admin", adminSchema);
