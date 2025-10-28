-- Add azure_blob_name and url columns to notes table
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "azure_blob_name" varchar(512);
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "url" varchar(1024);

-- Add azure_blob_name and url columns to whiteboards table
ALTER TABLE "whiteboards" ADD COLUMN IF NOT EXISTS "azure_blob_name" varchar(512);
ALTER TABLE "whiteboards" ADD COLUMN IF NOT EXISTS "url" varchar(1024);
