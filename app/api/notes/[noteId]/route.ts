import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { notes, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { uploadTextContentToAzure, getTextContentFromAzure, deleteTextContentFromAzure } from "@/lib/azure";

export const dynamic = "force-dynamic";

// Update a note
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noteId } = await params;
    const body = await req.json();
    const { title, content } = body;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify that the note belongs to the user and get existing data
    const noteExists = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, parseInt(noteId)), eq(notes.user_id, userId)))
      .limit(1);

    if (noteExists.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const existingNote = noteExists[0];

    // Update the note
    const updateData: any = {
      updated_at: new Date(),
    };

    if (title !== undefined) {
      updateData.title = title.trim();
    }

    // If content is being updated, upload to Azure
    if (content !== undefined) {
      const contentData = typeof content === "string" ? content : JSON.stringify(content);
      
      // Upload updated content to Azure (using the same blob path)
      const { blobName, url } = await uploadTextContentToAzure(
        contentData,
        userId,
        existingNote.folder_id,
        'note',
        existingNote.id
      );
      
      updateData.azure_blob_name = blobName;
      updateData.url = url;
    }

    const [updatedNote] = await db
      .update(notes)
      .set(updateData)
      .where(and(eq(notes.id, parseInt(noteId)), eq(notes.user_id, userId)))
      .returning();

    return NextResponse.json({ note: updatedNote }, { status: 200 });
  } catch (err: any) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// Get a single note
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noteId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get the note
    const note = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, parseInt(noteId)), eq(notes.user_id, userId)))
      .limit(1);

    if (note.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const noteData = note[0];
    
    // Fetch content from Azure
    try {
      const content = await getTextContentFromAzure(noteData.azure_blob_name);
      return NextResponse.json({ 
        note: {
          ...noteData,
          content: content
        } 
      }, { status: 200 });
    } catch (error) {
      console.error("Failed to fetch content from Azure:", error);
      return NextResponse.json({ 
        note: noteData,
        error: "Failed to fetch content" 
      }, { status: 200 });
    }
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch note" },
      { status: 500 }
    );
  }
}

// Delete a note
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { noteId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify that the note belongs to the user and get blob info
    const note = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, parseInt(noteId)), eq(notes.user_id, userId)))
      .limit(1);

    if (note.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Delete content from Azure
    try {
      await deleteTextContentFromAzure(note[0].azure_blob_name);
    } catch (error) {
      console.error("Failed to delete content from Azure:", error);
    }

    // Delete the note from database
    await db
      .delete(notes)
      .where(and(eq(notes.id, parseInt(noteId)), eq(notes.user_id, userId)));

    return NextResponse.json({ message: "Note deleted" }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}