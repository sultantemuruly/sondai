import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { users, folders, flashcard_groups, flashcards, notes, files, whiteboards } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateValidatedFlashcards } from '@/lib/agents/flashcard-agents';
import { uploadTextContentToAzure, getTextContentFromAzure } from '@/lib/azure';
import { extractTextFromFile } from '@/lib/file-extraction';
import { validateCumulativeFileSize } from '@/lib/file-limits';

export const dynamic = 'force-dynamic';

interface ContentItem {
  type: 'note' | 'file' | 'whiteboard';
  id: number;
}

/**
 * Extract text content from various sources
 */
async function extractContentFromItems(
  items: ContentItem[],
  userId: number,
  folderId: number
): Promise<string> {
  const contents: string[] = [];

  for (const item of items) {
    try {
      if (item.type === 'note') {
        const note = await db
          .select()
          .from(notes)
          .where(and(eq(notes.id, item.id), eq(notes.user_id, userId)))
          .limit(1);

        if (note.length > 0 && note[0].azure_blob_name) {
          const content = await getTextContentFromAzure(note[0].azure_blob_name);
          // Extract text from TipTap JSON
          try {
            const tipTapContent = JSON.parse(content);
            const extractText = (node: any): string => {
              if (node.type === 'text') return node.text || '';
              if (node.content && Array.isArray(node.content)) {
                return node.content.map(extractText).join(' ');
              }
              return '';
            };
            contents.push(extractText(tipTapContent));
          } catch {
            contents.push(content);
          }
        }
      } else if (item.type === 'file') {
        const file = await db
          .select()
          .from(files)
          .where(and(eq(files.id, item.id), eq(files.user_id, userId)))
          .limit(1);

        if (file.length > 0) {
          const fileData = file[0];
          try {
            // Try to extract text content from the file
            const extractedText = await extractTextFromFile(
              fileData.azure_blob_name,
              fileData.original_name,
              fileData.file_type
            );
            
            if (extractedText && extractedText.trim().length > 0) {
              // Limit extracted text to prevent token limits (keep first 50000 characters)
              const maxLength = 50000;
              const truncatedText = extractedText.length > maxLength 
                ? extractedText.substring(0, maxLength) + '\n\n[Content truncated for length]'
                : extractedText;
              
              // Add file context and extracted content
              contents.push(`File: ${fileData.name} (${fileData.original_name})\n\n${truncatedText}`);
            } else {
              // If extraction fails or returns empty, at least include the filename
              contents.push(`File: ${fileData.name} - ${fileData.original_name}`);
            }
          } catch (error: any) {
            console.error(`Error extracting content from file ${fileData.original_name}:`, error);
            // Fallback to just file name if extraction fails - don't fail the whole request
            contents.push(`File: ${fileData.name} - ${fileData.original_name}\nNote: Could not extract content from this file type: ${error.message || 'Unknown error'}`);
          }
        }
      } else if (item.type === 'whiteboard') {
        const whiteboard = await db
          .select()
          .from(whiteboards)
          .where(and(eq(whiteboards.id, item.id), eq(whiteboards.user_id, userId)))
          .limit(1);

        if (whiteboard.length > 0 && whiteboard[0].azure_blob_name) {
          const content = await getTextContentFromAzure(whiteboard[0].azure_blob_name);
          // Whiteboard content is JSON, extract meaningful text if possible
          contents.push(`Whiteboard: ${whiteboard[0].title}`);
          try {
            const wbContent = JSON.parse(content);
            if (wbContent.elements && Array.isArray(wbContent.elements)) {
              const textElements = wbContent.elements
                .filter((el: any) => el.type === 'text' && el.text)
                .map((el: any) => el.text)
                .join(' ');
              if (textElements) contents.push(textElements);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting content from ${item.type} ${item.id}:`, error);
    }
  }

  return contents.join('\n\n---\n\n');
}

/**
 * Generate flashcards from selected content
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { folder_id, name, items, target_count } = body;

    if (!folder_id || !name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'folder_id, name, and items array are required' },
        { status: 400 }
      );
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
      .where(and(eq(folders.id, parseInt(folder_id)), eq(folders.user_id, userId)))
      .limit(1);

    if (folderExists.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Validate cumulative file sizes for flashcard generation
    const fileItems = items.filter(item => item.type === 'file');
    if (fileItems.length > 0) {
      const fileIds = fileItems.map(item => item.id);
      
      // Get file sizes for all selected files
      const matchingFiles = await Promise.all(
        fileIds.map(async (fileId) => {
          const file = await db
            .select({ size: files.size })
            .from(files)
            .where(and(eq(files.id, fileId), eq(files.user_id, userId)))
            .limit(1);
          return file[0]?.size || 0;
        })
      );

      const totalFileSize = matchingFiles.reduce((sum, size) => sum + size, 0);
      const sizeValidation = validateCumulativeFileSize(totalFileSize);
      
      if (!sizeValidation.valid) {
        return NextResponse.json(
          { error: sizeValidation.error },
          { status: 400 }
        );
      }
    }

    // Extract content from selected items
    const content = await extractContentFromItems(items, userId, parseInt(folder_id));

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'No content could be extracted from selected items' },
        { status: 400 }
      );
    }

    // Generate flashcards using the agentic system
    const result = await generateValidatedFlashcards(content, target_count || 10);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to generate flashcards',
          validationResult: result.validationResult,
        },
        { status: 400 }
      );
    }

    // Check if tables exist, create flashcard group in database
    let newGroup;
    try {
      [newGroup] = await db
        .insert(flashcard_groups)
        .values({
          folder_id: parseInt(folder_id),
          user_id: userId,
          name: name.trim(),
          azure_blob_name: '', // Temporary
          url: '', // Temporary
        })
        .returning();
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'Flashcard tables not found',
            message: 'Please run the database migration. See apply_flashcard_migration.sql',
          },
          { status: 500 }
        );
      }
      throw error;
    }

    // Store flashcard data in Azure
    const flashcardData = {
      flashcards: result.flashcards,
      generated_at: new Date().toISOString(),
      source_items: items,
      quality_issues: result.qualityIssues,
    };

    const { blobName, url } = await uploadTextContentToAzure(
      JSON.stringify(flashcardData),
      userId,
      parseInt(folder_id),
      'flashcard_group',
      newGroup.id
    );

    // Update group with Azure info
    const [updatedGroup] = await db
      .update(flashcard_groups)
      .set({
        azure_blob_name: blobName,
        url: url,
      })
      .where(eq(flashcard_groups.id, newGroup.id))
      .returning();

    // Insert flashcards into database
    try {
      const flashcardInserts = result.flashcards.map((fc) => ({
        flashcard_group_id: newGroup.id,
        term: fc.term,
        explanation: fc.explanation,
      }));

      if (flashcardInserts.length > 0) {
        await db.insert(flashcards).values(flashcardInserts);
      }
    } catch (error: any) {
      if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
        return NextResponse.json(
          {
            error: 'Flashcard tables not found',
            message: 'Please run the database migration. See apply_flashcard_migration.sql',
          },
          { status: 500 }
        );
      }
      throw error;
    }

    // Fetch the created flashcards
    const createdFlashcards = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.flashcard_group_id, newGroup.id));

    return NextResponse.json(
      {
        flashcard_group: updatedGroup,
        flashcards: createdFlashcards,
        validation_result: result.validationResult,
        quality_issues: result.qualityIssues,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Flashcard generation error:', err);
    
    // Ensure we always return JSON, never HTML
    const errorMessage = err?.message || 'Unknown error occurred';
    const errorDetails = process.env.NODE_ENV === 'development' 
      ? { message: errorMessage, stack: err?.stack }
      : { message: errorMessage };
    
    return NextResponse.json(
      { 
        error: 'Failed to generate flashcards', 
        details: errorDetails,
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

