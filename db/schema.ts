import { pgTable, integer, varchar, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  clerk_id: varchar("clerk_id", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  first_name: varchar("first_name", { length: 128 }).notNull(),
  last_name: varchar("last_name", { length: 128 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const folders = pgTable("folders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
