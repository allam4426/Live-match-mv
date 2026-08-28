import { defineConfig } from "drizzle-kit";
import path from "path";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema-d1/index.ts"),
  out: path.join(__dirname, "./drizzle-d1"),
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: "d7dce5e7-6932-4ac7-a0c8-7d695d5dbbc8",
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
});
