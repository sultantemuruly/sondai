import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { folders, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/folders - Get all folders for the current user
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get all folders for this user
    const userFolders = await db
      .select()
      .from(folders)
      .where(eq(folders.user_id, userId))
      .orderBy(folders.created_at);

    return NextResponse.json({ folders: userFolders }, { status: 200 });
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    );
  }
}

// POST /api/folders - Create a new folder
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Get user from database
    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Create the folder
    const [newFolder] = await db
      .insert(folders)
      .values({
        user_id: userId,
        name: name.trim(),
      })
      .returning();

    return NextResponse.json({ folder: newFolder }, { status: 201 });
  } catch (err: any) {
    console.error("Database error:", err);
    
    if (err?.code === "23505") {
      // unique_violation (shouldn't happen with current schema, but handle it)
      return NextResponse.json(
        { error: "Folder already exists" },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}

