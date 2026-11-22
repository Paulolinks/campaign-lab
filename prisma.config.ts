import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Local default = compose.dev.yaml. Production sets DATABASE_URL.
    url: process.env["DATABASE_URL"] ?? "postgresql://campaignlab:campaignlab@127.0.0.1:5434/campaignlab",
  },
});
