-- Add azure_blob_name and url columns to notes table
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "azure_blob_name" varchar(512);
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "url" varchar(1024);
--> statement-breakpoint

-- Add azure_blob_name and url columns to whiteboards table
ALTER TABLE "whiteboards" ADD COLUMN IF NOT EXISTS "azure_blob_name" varchar(512);
ALTER TABLE "whiteboards" ADD COLUMN IF NOT EXISTS "url" varchar(1024);
--> statement-breakpoint

-- Make the new columns NOT NULL after data migration (for future use)
-- Note: Set default values for now, actual migration of content to Azure should be done separately

