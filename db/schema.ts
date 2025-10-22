import { integer, pgTable, varchar, uniqueIndex } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  userName: varchar("user_name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
});
