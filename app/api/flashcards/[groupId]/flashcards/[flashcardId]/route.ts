import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, flashcard_groups, flashcards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Update a single flashcard
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; flashcardId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, flashcardId } = await params;
    const body = await req.json();
    const { term, explanation } = body;

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

    // Verify flashcard belongs to this group
    const flashcardExists = await db
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.id, parseInt(flashcardId)), eq(flashcards.flashcard_group_id, parseInt(groupId)))
      )
      .limit(1);

    if (flashcardExists.length === 0) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (term !== undefined) {
      if (typeof term !== 'string' || term.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid term' }, { status: 400 });
      }
      updateData.term = term.trim();
    }

    if (explanation !== undefined) {
      if (typeof explanation !== 'string' || explanation.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid explanation' }, { status: 400 });
      }
      updateData.explanation = explanation.trim();
    }

    const [updatedFlashcard] = await db
      .update(flashcards)
      .set(updateData)
      .where(eq(flashcards.id, parseInt(flashcardId)))
      .returning();

    return NextResponse.json({ flashcard: updatedFlashcard }, { status: 200 });
  } catch (err: any) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Failed to update flashcard' }, { status: 500 });
  }
}

/**
 * Delete a single flashcard
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; flashcardId: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { groupId, flashcardId } = await params;

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

    // Verify flashcard belongs to this group
    const flashcardExists = await db
      .select()
      .from(flashcards)
      .where(
        and(eq(flashcards.id, parseInt(flashcardId)), eq(flashcards.flashcard_group_id, parseInt(groupId)))
      )
      .limit(1);

    if (flashcardExists.length === 0) {
      return NextResponse.json({ error: 'Flashcard not found' }, { status: 404 });
    }

    // Delete flashcard
    await db.delete(flashcards).where(eq(flashcards.id, parseInt(flashcardId)));

    return NextResponse.json({ message: 'Flashcard deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Failed to delete flashcard' }, { status: 500 });
  }
}

