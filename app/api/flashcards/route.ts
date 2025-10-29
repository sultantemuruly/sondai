import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, folders, flashcard_groups, flashcards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * Get all flashcard groups in a folder
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folder_id');

    if (!folderId) {
      return NextResponse.json({ error: 'folder_id is required' }, { status: 400 });
    }

    const dbUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (dbUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userId = dbUser[0].id;

    // Verify folder belongs to user
    const folderExists = await db
      .select()
      .from(folders)
      .where(and(eq(folders.id, parseInt(folderId)), eq(folders.user_id, userId)))
      .limit(1);

    if (folderExists.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Get all flashcard groups for this folder
    let groups;
    try {
      groups = await db
        .select()
        .from(flashcard_groups)
        .where(and(eq(flashcard_groups.folder_id, parseInt(folderId)), eq(flashcard_groups.user_id, userId)))
        .orderBy(flashcard_groups.updated_at);
    } catch (error: any) {
      // If tables don't exist yet, return empty array
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        console.warn('Flashcard tables not found. Please run the migration: apply_flashcard_migration.sql');
        return NextResponse.json({ flashcard_groups: [] }, { status: 200 });
      }
      throw error;
    }

    // Get flashcards for each group
    const groupsWithFlashcards = await Promise.all(
      groups.map(async (group) => {
        const groupFlashcards = await db
          .select()
          .from(flashcards)
          .where(eq(flashcards.flashcard_group_id, group.id));

        return {
          ...group,
          flashcard_count: groupFlashcards.length,
        };
      })
    );

    return NextResponse.json({ flashcard_groups: groupsWithFlashcards }, { status: 200 });
  } catch (err) {
    console.error('Database error:', err);
    return NextResponse.json({ error: 'Failed to fetch flashcard groups' }, { status: 500 });
  }
}

