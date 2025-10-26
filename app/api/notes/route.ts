import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { notes, users, folders } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Get all notes for a specific folder
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get("folder_id");

    if (!folderId) {
      return NextResponse.json({ error: "folder_id is required" }, { status: 400 });
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

    // Verify that the folder belongs to the user
    const folderExists = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)))
      .limit(1);

    if (folderExists.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Get all notes for this folder
    const folderNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.folder_id, parseInt(folderId)), eq(notes.user_id, userId)))
      .orderBy(notes.updated_at);

    return NextResponse.json({ notes: folderNotes }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// Create a new note
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { folder_id, title, content } = body;

    if (!folder_id || !title) {
      return NextResponse.json(
        { error: "folder_id and title are required" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Content should be a JSON string with Excalidraw data
    const contentData = typeof content === "string" ? content : JSON.stringify(content || {});
    
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
    const folderExists = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parseInt(folder_id)), eq(folders.user_id, userId)))
      .limit(1);

    if (folderExists.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Create the note
    const [newNote] = await db
      .insert(notes)
      .values({
        folder_id: parseInt(folder_id),
        user_id: userId,
        title: title.trim(),
        content: contentData,
      })
      .returning();

    return NextResponse.json({ note: newNote }, { status: 201 });
  } catch (err: any) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

