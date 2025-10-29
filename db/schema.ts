import { pgTable, integer, varchar, timestamp, text } from "drizzle-orm/pg-core";

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
  parent_id: integer("parent_id"),
  name: varchar("name", { length: 256 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const whiteboards = pgTable("whiteboards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  folder_id: integer("folder_id").references(() => folders.id).notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  azure_blob_name: varchar("azure_blob_name", { length: 512 }).notNull(), // Azure blob identifier for content
  url: varchar("url", { length: 1024 }).notNull(), // SAS URL or public URL
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  folder_id: integer("folder_id").references(() => folders.id).notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  azure_blob_name: varchar("azure_blob_name", { length: 512 }).notNull(), // Azure blob identifier for content
  url: varchar("url", { length: 1024 }).notNull(), // SAS URL or public URL
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const files = pgTable("files", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  folder_id: integer("folder_id").references(() => folders.id).notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  original_name: varchar("original_name", { length: 512 }).notNull(),
  file_type: varchar("file_type", { length: 128 }).notNull(), // e.g., pdf, docx, jpeg
  size: integer("size").notNull(), // File size in bytes
  azure_blob_name: varchar("azure_blob_name", { length: 512 }).notNull(), // Azure blob identifier
  url: varchar("url", { length: 1024 }).notNull(), // SAS URL or public URL
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const flashcard_groups = pgTable("flashcard_groups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  folder_id: integer("folder_id").references(() => folders.id).notNull(),
  user_id: integer("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  azure_blob_name: varchar("azure_blob_name", { length: 512 }).notNull(), // Azure blob identifier for flashcard data
  url: varchar("url", { length: 1024 }).notNull(), // SAS URL
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const flashcards = pgTable("flashcards", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  flashcard_group_id: integer("flashcard_group_id").references(() => flashcard_groups.id, { onDelete: "cascade" }).notNull(),
  term: text("term").notNull(),
  explanation: text("explanation").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
