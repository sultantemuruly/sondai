import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { files, users } from "@/db/schema";
import { deleteFileFromAzure, generateSASUrl } from "@/lib/azure";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Get a specific file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get the file
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, parseInt(fileId)))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify the file belongs to the user
    if (file.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate a fresh SAS URL for viewing
    const freshUrl = generateSASUrl(file.azure_blob_name);
    
    return NextResponse.json({ 
      file: {
        ...file,
        url: freshUrl
      }
    }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    );
  }
}

// Update a file (rename)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      );
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

    // Get the file
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, parseInt(fileId)))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify the file belongs to the user
    if (file.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update the file name
    const [updatedFile] = await db
      .update(files)
      .set({ name: name.trim() })
      .where(eq(files.id, parseInt(fileId)))
      .returning();

    return NextResponse.json({ file: updatedFile }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to update file" },
      { status: 500 }
    );
  }
}

// Delete a file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get the file
    const [file] = await db
      .select()
      .from(files)
      .where(eq(files.id, parseInt(fileId)))
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify the file belongs to the user
    if (file.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete from Azure Blob Storage
    try {
      await deleteFileFromAzure(file.azure_blob_name);
    } catch (err) {
      console.error('Failed to delete from Azure:', err);
      // Continue with database deletion even if Azure deletion fails
    }

    // Delete from database
    await db
      .delete(files)
      .where(eq(files.id, parseInt(fileId)));

    return NextResponse.json({ message: "File deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("File deletion error:", err);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

