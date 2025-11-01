import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { folders, users, notes, whiteboards, files, flashcard_groups } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteFileFromAzure, deleteTextContentFromAzure } from "@/lib/azure";

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

// Update a folder (rename)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { folderId } = await params;
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
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

    // Verify that the folder belongs to the user
    const folder = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)))
      .limit(1);

    if (folder.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Update the folder name
    const [updatedFolder] = await db
      .update(folders)
      .set({ name: name.trim() })
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)))
      .returning();

    return NextResponse.json({ folder: updatedFolder }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to update folder" },
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

    // Delete all related items in the folder first
    // 1. Delete all notes
    const notesInFolder = await db
      .select()
      .from(notes)
      .where(and(eq(notes.folder_id, parseInt(folderId)), eq(notes.user_id, userId)));

    for (const note of notesInFolder) {
      try {
        await deleteTextContentFromAzure(note.azure_blob_name);
      } catch (error) {
        console.error(`Failed to delete note blob ${note.azure_blob_name}:`, error);
      }
    }
    await db
      .delete(notes)
      .where(and(eq(notes.folder_id, parseInt(folderId)), eq(notes.user_id, userId)));

    // 2. Delete all whiteboards
    const whiteboardsInFolder = await db
      .select()
      .from(whiteboards)
      .where(and(eq(whiteboards.folder_id, parseInt(folderId)), eq(whiteboards.user_id, userId)));

    for (const whiteboard of whiteboardsInFolder) {
      try {
        await deleteTextContentFromAzure(whiteboard.azure_blob_name);
      } catch (error) {
        console.error(`Failed to delete whiteboard blob ${whiteboard.azure_blob_name}:`, error);
      }
    }
    await db
      .delete(whiteboards)
      .where(and(eq(whiteboards.folder_id, parseInt(folderId)), eq(whiteboards.user_id, userId)));

    // 3. Delete all files
    const filesInFolder = await db
      .select()
      .from(files)
      .where(and(eq(files.folder_id, parseInt(folderId)), eq(files.user_id, userId)));

    for (const file of filesInFolder) {
      try {
        await deleteFileFromAzure(file.azure_blob_name);
      } catch (error) {
        console.error(`Failed to delete file blob ${file.azure_blob_name}:`, error);
      }
    }
    await db
      .delete(files)
      .where(and(eq(files.folder_id, parseInt(folderId)), eq(files.user_id, userId)));

    // 4. Delete all flashcard groups (flashcards will cascade delete)
    const flashcardGroupsInFolder = await db
      .select()
      .from(flashcard_groups)
      .where(and(eq(flashcard_groups.folder_id, parseInt(folderId)), eq(flashcard_groups.user_id, userId)));

    for (const group of flashcardGroupsInFolder) {
      try {
        await deleteTextContentFromAzure(group.azure_blob_name);
      } catch (error) {
        console.error(`Failed to delete flashcard group blob ${group.azure_blob_name}:`, error);
      }
    }
    await db
      .delete(flashcard_groups)
      .where(and(eq(flashcard_groups.folder_id, parseInt(folderId)), eq(flashcard_groups.user_id, userId)));

    // 5. Recursively delete all subfolders and their contents
    const deleteSubfolderRecursive = async (subfolderId: number) => {
      // Get all items in subfolder
      const subNotes = await db.select().from(notes).where(and(eq(notes.folder_id, subfolderId), eq(notes.user_id, userId)));
      for (const note of subNotes) {
        try {
          await deleteTextContentFromAzure(note.azure_blob_name);
        } catch (error) {
          console.error(`Failed to delete note blob:`, error);
        }
      }
      await db.delete(notes).where(and(eq(notes.folder_id, subfolderId), eq(notes.user_id, userId)));

      const subWhiteboards = await db.select().from(whiteboards).where(and(eq(whiteboards.folder_id, subfolderId), eq(whiteboards.user_id, userId)));
      for (const whiteboard of subWhiteboards) {
        try {
          await deleteTextContentFromAzure(whiteboard.azure_blob_name);
        } catch (error) {
          console.error(`Failed to delete whiteboard blob:`, error);
        }
      }
      await db.delete(whiteboards).where(and(eq(whiteboards.folder_id, subfolderId), eq(whiteboards.user_id, userId)));

      const subFiles = await db.select().from(files).where(and(eq(files.folder_id, subfolderId), eq(files.user_id, userId)));
      for (const file of subFiles) {
        try {
          await deleteFileFromAzure(file.azure_blob_name);
        } catch (error) {
          console.error(`Failed to delete file blob:`, error);
        }
      }
      await db.delete(files).where(and(eq(files.folder_id, subfolderId), eq(files.user_id, userId)));

      const subFlashcardGroups = await db.select().from(flashcard_groups).where(and(eq(flashcard_groups.folder_id, subfolderId), eq(flashcard_groups.user_id, userId)));
      for (const group of subFlashcardGroups) {
        try {
          await deleteTextContentFromAzure(group.azure_blob_name);
        } catch (error) {
          console.error(`Failed to delete flashcard group blob:`, error);
        }
      }
      await db.delete(flashcard_groups).where(and(eq(flashcard_groups.folder_id, subfolderId), eq(flashcard_groups.user_id, userId)));

      // Recursively delete nested subfolders
      const nestedSubfolders = await db.select().from(folders).where(and(eq(folders.parent_id, subfolderId), eq(folders.user_id, userId)));
      for (const nestedSubfolder of nestedSubfolders) {
        await deleteSubfolderRecursive(nestedSubfolder.id);
      }

      // Delete the subfolder itself
      await db.delete(folders).where(and(eq(folders.id, subfolderId), eq(folders.user_id, userId)));
    };

    // Get all direct subfolders and delete them recursively
    const subfolders = await db
      .select()
      .from(folders)
      .where(and(eq(folders.parent_id, parseInt(folderId)), eq(folders.user_id, userId)));

    for (const subfolder of subfolders) {
      await deleteSubfolderRecursive(subfolder.id);
    }

    // 6. Finally, delete the folder itself
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

