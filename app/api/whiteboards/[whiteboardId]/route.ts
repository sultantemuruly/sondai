import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { whiteboards, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { uploadTextContentToAzure, getTextContentFromAzure, deleteTextContentFromAzure } from "@/lib/azure";

export const dynamic = "force-dynamic";

// Update a whiteboard
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ whiteboardId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { whiteboardId } = await params;
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

    // Verify that the whiteboard belongs to the user and get existing data
    const whiteboardExists = await db
      .select()
      .from(whiteboards)
      .where(and(eq(whiteboards.id, parseInt(whiteboardId)), eq(whiteboards.user_id, userId)))
      .limit(1);

    if (whiteboardExists.length === 0) {
      return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
    }

    const existingWhiteboard = whiteboardExists[0];

    // Update the whiteboard
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
        existingWhiteboard.folder_id,
        'whiteboard',
        existingWhiteboard.id
      );
      
      updateData.azure_blob_name = blobName;
      updateData.url = url;
    }

    const [updatedWhiteboard] = await db
      .update(whiteboards)
      .set(updateData)
      .where(and(eq(whiteboards.id, parseInt(whiteboardId)), eq(whiteboards.user_id, userId)))
      .returning();

    return NextResponse.json({ whiteboard: updatedWhiteboard }, { status: 200 });
  } catch (err: any) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to update whiteboard" },
      { status: 500 }
    );
  }
}

// Get a single whiteboard
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ whiteboardId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { whiteboardId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get the whiteboard
    const whiteboard = await db
      .select()
      .from(whiteboards)
      .where(and(eq(whiteboards.id, parseInt(whiteboardId)), eq(whiteboards.user_id, userId)))
      .limit(1);

    if (whiteboard.length === 0) {
      return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
    }

    const whiteboardData = whiteboard[0];
    
    // Fetch content from Azure
    try {
      const content = await getTextContentFromAzure(whiteboardData.azure_blob_name);
      return NextResponse.json({ 
        whiteboard: {
          ...whiteboardData,
          content: content
        } 
      }, { status: 200 });
    } catch (error) {
      console.error("Failed to fetch content from Azure:", error);
      return NextResponse.json({ 
        whiteboard: whiteboardData,
        error: "Failed to fetch content" 
      }, { status: 200 });
    }
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch whiteboard" },
      { status: 500 }
    );
  }
}

// Delete a whiteboard
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ whiteboardId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { whiteboardId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify that the whiteboard belongs to the user and get blob info
    const whiteboard = await db
      .select()
      .from(whiteboards)
      .where(and(eq(whiteboards.id, parseInt(whiteboardId)), eq(whiteboards.user_id, userId)))
      .limit(1);

    if (whiteboard.length === 0) {
      return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
    }

    // Delete content from Azure
    try {
      await deleteTextContentFromAzure(whiteboard[0].azure_blob_name);
    } catch (error) {
      console.error("Failed to delete content from Azure:", error);
    }

    // Delete the whiteboard from database
    await db
      .delete(whiteboards)
      .where(and(eq(whiteboards.id, parseInt(whiteboardId)), eq(whiteboards.user_id, userId)));

    return NextResponse.json({ message: "Whiteboard deleted" }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to delete whiteboard" },
      { status: 500 }
    );
  }
}
