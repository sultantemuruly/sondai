import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { files, users } from "@/db/schema";
import { uploadFileToAzure, generateSASUrl } from "@/lib/azure";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = 'nodejs'; // Required for file uploads

// Get all files for a specific folder
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get folder_id from query params
    const searchParams = req.nextUrl.searchParams;
    const folderId = searchParams.get('folder_id');

    if (!folderId) {
      return NextResponse.json({ error: "folder_id is required" }, { status: 400 });
    }

    // Get all files for this folder that belong to the user
    const userFiles = await db
      .select()
      .from(files)
      .where(eq(files.user_id, userId))
      .orderBy(files.created_at);

    const folderFiles = userFiles.filter(file => file.folder_id === parseInt(folderId));

    // Generate fresh SAS URLs for each file
    const filesWithFreshUrls = folderFiles.map(file => ({
      ...file,
      url: generateSASUrl(file.azure_blob_name)
    }));

    return NextResponse.json({ files: filesWithFreshUrls }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

// Upload a new file
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folderId = formData.get('folder_id');

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!folderId) {
      return NextResponse.json({ error: "folder_id is required" }, { status: 400 });
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 100MB limit" }, { status: 400 });
    }

    // Upload to Azure Blob Storage
    const { blobName, url } = await uploadFileToAzure(file, userId, parseInt(folderId as string));

    // Store file metadata in database
    const [newFile] = await db
      .insert(files)
      .values({
        user_id: userId,
        folder_id: parseInt(folderId as string),
        name: file.name.split('.')[0], // Name without extension
        original_name: file.name,
        file_type: file.type || 'application/octet-stream',
        size: file.size,
        azure_blob_name: blobName,
        url: url,
      })
      .returning();

    return NextResponse.json({ file: newFile }, { status: 201 });
  } catch (err: any) {
    console.error("File upload error:", err);
    
    if (err.message?.includes('Azure Storage is not configured')) {
      return NextResponse.json(
        { error: "File storage is not configured. Please configure Azure Blob Storage." },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}

