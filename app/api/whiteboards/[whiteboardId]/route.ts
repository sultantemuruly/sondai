import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { whiteboards, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

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

    // Verify that the whiteboard belongs to the user
    const whiteboardExists = await db
      .select()
      .from(whiteboards)
      .where(and(eq(whiteboards.id, parseInt(whiteboardId)), eq(whiteboards.user_id, userId)))
      .limit(1);

    if (whiteboardExists.length === 0) {
      return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 });
    }

    // Update the whiteboard
    const updateData: any = {
      updated_at: new Date(),
    };

    if (title !== undefined) {
      updateData.title = title.trim();
    }

    if (content !== undefined) {
      updateData.content = typeof content === "string" ? content : JSON.stringify(content);
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

    return NextResponse.json({ whiteboard: whiteboard[0] }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch whiteboard" },
      { status: 500 }
    );
  }
}
