import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { folders, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Get subfolders for a specific folder
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify that the folder belongs to the user
    const folder = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)))
      .limit(1);

    if (folder.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Get all subfolders for this folder
    const subfolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.parent_id, parseInt(folderId)), eq(folders.user_id, userId)))
      .orderBy(folders.created_at);

    return NextResponse.json({ folder: folder[0], subfolders }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch folder" },
      { status: 500 }
    );
  }
}

// Delete a folder
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify that the folder belongs to the user
    const folder = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)))
      .limit(1);

    if (folder.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Delete the folder
    await db
      .delete(folders)
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)));

    return NextResponse.json({ message: "Folder deleted" }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    );
  }
}

