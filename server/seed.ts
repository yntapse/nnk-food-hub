import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "./db";

const SALT_ROUNDS = 10;

const seedData = {
  admin: { email: "admin@foodhub.local", password: "Admin@123", name: "Super Admin" },
  users: [
    { name: "Ravi Kumar", email: "ravi@example.com", password: "User@123", phone: "9876543210", address: "Main Bazaar Road, Small Town" },
    { name: "Priya Sharma", email: "priya@example.com", password: "User@123", phone: "9876500001", address: "Bus Stand Area, Small Town" },
  ],
  riders: [
    { name: "Aman Rider", email: "aman.rider@example.com", password: "Rider@123", phone: "9000000001" },
    { name: "Vijay Rider", email: "vijay.rider@example.com", password: "Rider@123", phone: "9000000002" },
  ],
  hotels: [
    {
      name: "Town Biryani House", email: "biryani@example.com", password: "Hotel@123",
      phone: "8000000001", location: "Clock Tower Street", category: "Biryani",
      menu: [
        { name: "Chicken Biryani", description: "Spicy dum biryani", price: 199, category: "Main Course" },
        { name: "Veg Biryani", description: "Aromatic veg biryani", price: 149, category: "Main Course" },
        { name: "Raita", description: "Curd with herbs", price: 39, category: "Appetizers" },
      ],
    },
    {
      name: "Pizza Point", email: "pizza@example.com", password: "Hotel@123",
      phone: "8000000002", location: "Market Circle", category: "Pizza",
      menu: [
        { name: "Margherita Pizza", description: "Classic cheese pizza", price: 249, category: "Main Course" },
        { name: "Farmhouse Pizza", description: "Loaded veggie pizza", price: 299, category: "Main Course" },
        { name: "Cold Coffee", description: "Chilled coffee", price: 89, category: "Beverages" },
      ],
    },
    {
      name: "Street Dosa Corner", email: "dosa@example.com", password: "Hotel@123",
      phone: "8000000003", location: "Temple Road", category: "South Indian",
      menu: [
        { name: "Masala Dosa", description: "Crispy dosa with potato masala", price: 99, category: "Main Course" },
        { name: "Idli Sambar", description: "Soft idlis with sambar", price: 79, category: "Main Course" },
        { name: "Filter Coffee", description: "South Indian filter coffee", price: 49, category: "Beverages" },
      ],
    },
  ],
};

export async function seedDB(): Promise<void> {
  // Admin
  const adminExists = await prisma.admin.findUnique({ where: { email: seedData.admin.email } });
  if (!adminExists) {
    const hashed = await bcrypt.hash(seedData.admin.password, SALT_ROUNDS);
    await prisma.admin.create({ data: { ...seedData.admin, password: hashed } });
    console.log("  ✓ Admin seeded");
  }

  // Users
  for (const u of seedData.users) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);
      await prisma.user.create({ data: { ...u, password: hashed } });
      console.log(`  ✓ User seeded: ${u.email}`);
    }
  }

  // Riders
  for (const r of seedData.riders) {
    const exists = await prisma.rider.findUnique({ where: { email: r.email } });
    if (!exists) {
      const hashed = await bcrypt.hash(r.password, SALT_ROUNDS);
      await prisma.rider.create({ data: { ...r, password: hashed } });
      console.log(`  ✓ Rider seeded: ${r.email}`);
    }
  }

  // Hotels + menu items
  for (const h of seedData.hotels) {
    const { menu, ...hotelData } = h;
    const exists = await prisma.hotel.findUnique({ where: { email: hotelData.email } });
    if (!exists) {
      const hashed = await bcrypt.hash(hotelData.password, SALT_ROUNDS);
      const hotel = await prisma.hotel.create({ data: { ...hotelData, password: hashed } });
      for (const item of menu) {
        await prisma.menuItem.create({ data: { ...item, hotelId: hotel.id } });
      }
      console.log(`  ✓ Hotel seeded: ${hotelData.email} (${menu.length} items)`);
    }
  }
}

// Allow running standalone: pnpm seed
async function runStandalone() {
  console.log("Seeding database...");
  await seedDB();
  console.log("Done.");
  await prisma.$disconnect();
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") ||
    process.argv[1].endsWith("seed.js") ||
    process.argv[1].endsWith("seed.mjs"))
) {
  runStandalone().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

