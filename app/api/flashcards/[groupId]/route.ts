import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, flashcard_groups, flashcards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { uploadTextContentToAzure, getTextContentFromAzure } from '@/lib/azure';

export const dynamic = 'force-dynamic';

/**
 * Get a flashcard group with its flashcards
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Get the flashcard group
    const group = await db
      .select()
      .from(flashcard_groups)
      .where(and(eq(flashcard_groups.id, parseInt(groupId)), eq(flashcard_groups.user_id, userId)))
      .limit(1);

    if (group.length === 0) {
      return NextResponse.json({ error: 'Flashcard group not found' }, { status: 404 });
    }

    // Get all flashcards for this group
    const groupFlashcards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.flashcard_group_id, parseInt(groupId)))
      .orderBy(flashcards.created_at);

    // Get full data from Azure if needed
    let fullData = null;
    try {
      if (group[0].azure_blob_name) {
        const content = await getTextContentFromAzure(group[0].azure_blob_name);
        fullData = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error fetching full data from Azure:', error);
    }

    return NextResponse.json(
      {
        flashcard_group: group[0],
        flashcards: groupFlashcards,
        full_data: fullData,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Failed to fetch flashcard group' }, { status: 500 });
  }
}

/**
 * Update flashcard group name
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;
    const body = await req.json();
    const { name } = body;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify group belongs to user
    const groupExists = await db
      .select()
      .from(flashcard_groups)
      .where(and(eq(flashcard_groups.id, parseInt(groupId)), eq(flashcard_groups.user_id, userId)))
      .limit(1);

    if (groupExists.length === 0) {
      return NextResponse.json({ error: 'Flashcard group not found' }, { status: 404 });
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    const [updatedGroup] = await db
      .update(flashcard_groups)
      .set(updateData)
      .where(and(eq(flashcard_groups.id, parseInt(groupId)), eq(flashcard_groups.user_id, userId)))
      .returning();

    return NextResponse.json({ flashcard_group: updatedGroup }, { status: 200 });
  } catch (err: any) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Failed to update flashcard group' }, { status: 500 });
  }
}

/**
 * Delete a flashcard group (cascades to flashcards)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId } = await params;

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify group belongs to user
    const groupExists = await db
      .select()
      .from(flashcard_groups)
      .where(and(eq(flashcard_groups.id, parseInt(groupId)), eq(flashcard_groups.user_id, userId)))
      .limit(1);

    if (groupExists.length === 0) {
      return NextResponse.json({ error: 'Flashcard group not found' }, { status: 404 });
    }

    // Delete group (cascades to flashcards)
    await db
      .delete(flashcard_groups)
      .where(and(eq(flashcard_groups.id, parseInt(groupId)), eq(flashcard_groups.user_id, userId)));

    return NextResponse.json({ message: 'Flashcard group deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Failed to delete flashcard group' }, { status: 500 });
  }
}

