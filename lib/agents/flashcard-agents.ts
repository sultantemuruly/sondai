import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface Flashcard {
  term: string;
  explanation: string;
}

export interface ValidationResult {
  isValid: boolean;
  canGenerateMinimum: boolean;
  minimumFlashcards: number;
  reason?: string;
}

/**
 * Agent 1: Input Validation Agent
 * Checks if the provided content is sufficient to generate at least 3 flashcards
 */
export async function validateInputForFlashcards(
  content: string
): Promise<ValidationResult> {
  const prompt = `You are an educational content validator. Analyze the following content and determine if it contains enough information to generate at least 3 meaningful flashcards.

Content:
${content}

Respond with a JSON object containing:
{
  "isValid": boolean - whether the content is valid educational material,
  "canGenerateMinimum": boolean - whether there's enough content for at least 3 flashcards,
  "minimumFlashcards": number - the minimum number of flashcards that can be generated from this content (should be at least 3),
  "reason": string - brief explanation of your decision (required if isValid or canGenerateMinimum is false)
}

Be strict: The content must have clear concepts, terms, definitions, or relationships that can be learned.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content validator. You analyze content and determine if it can be used to create meaningful flashcards. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const result: ValidationResult = JSON.parse(response);
    return result;
  } catch (error) {
    console.error('Error in input validation:', error);
    return {
      isValid: false,
      canGenerateMinimum: false,
      minimumFlashcards: 0,
      reason: 'Error validating input content',
    };
  }
}

/**
 * Agent 2: Flashcard Generation Agent
 * Generates flashcards from the validated content
 */
export async function generateFlashcards(
  content: string,
  count: number = 10
): Promise<Flashcard[]> {
  const prompt = `You are an expert educational content creator. Generate ${count} high-quality flashcards from the following content.

Content:
${content}

Generate flashcards that:
1. Cover the most important concepts, terms, definitions, and relationships
2. Have clear, concise terms (questions or key concepts)
3. Have detailed but understandable explanations
4. Are well-structured and educational
5. Avoid redundancy

Respond with a JSON object in this exact format:
{
  "flashcards": [
    {
      "term": "string - the term, concept, or question",
      "explanation": "string - detailed explanation or answer"
    }
  ]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational content creator specializing in creating high-quality flashcards. Always respond with valid JSON only in the exact format specified.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(response);
    return result.flashcards || [];
  } catch (error) {
    console.error('Error in flashcard generation:', error);
    throw new Error('Failed to generate flashcards');
  }
}

/**
 * Agent 3: Quality Validation Agent
 * Reviews generated flashcards for accuracy and quality
 */
export async function validateFlashcardQuality(
  flashcards: Flashcard[],
  originalContent: string
): Promise<{
  isValid: boolean;
  validatedFlashcards: Flashcard[];
  issues: string[];
  corrections?: Flashcard[];
}> {
  const flashcardsJson = JSON.stringify(flashcards, null, 2);

  const prompt = `You are an expert educational quality reviewer. Review the following flashcards for accuracy, correctness, and educational value based on the original content.

Original Content:
${originalContent}

Generated Flashcards:
${flashcardsJson}

For each flashcard, check:
1. Is the term clear and accurate?
2. Is the explanation correct and based on the original content?
3. Is the explanation comprehensive enough?
4. Are there any factual errors?
5. Is the flashcard educationally valuable?

Respond with a JSON object:
{
  "isValid": boolean - whether all flashcards meet quality standards,
  "validatedFlashcards": array - the flashcards that pass validation (corrected if needed),
  "issues": array of strings - list of issues found (empty if none),
  "corrections": array of Flashcard objects - corrected versions of invalid flashcards (if any)
}

If a flashcard has minor errors, provide a corrected version. If a flashcard is fundamentally wrong, exclude it from validatedFlashcards.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educational quality reviewer. You ensure flashcards are accurate, correct, and educationally valuable. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(response);
    return {
      isValid: result.isValid ?? false,
      validatedFlashcards: result.validatedFlashcards || flashcards,
      issues: result.issues || [],
      corrections: result.corrections,
    };
  } catch (error) {
    console.error('Error in quality validation:', error);
    // Return original flashcards if validation fails
    return {
      isValid: true,
      validatedFlashcards: flashcards,
      issues: ['Quality validation failed, using original flashcards'],
    };
  }
}

/**
 * Main Orchestration Function
 * Runs all three agents in sequence
 */
export async function generateValidatedFlashcards(
  content: string,
  targetCount: number = 10
): Promise<{
  success: boolean;
  flashcards: Flashcard[];
  validationResult: ValidationResult;
  qualityIssues?: string[];
  error?: string;
}> {
  try {
    // Step 1: Input Validation
    const validationResult = await validateInputForFlashcards(content);

    if (!validationResult.isValid || !validationResult.canGenerateMinimum) {
      return {
        success: false,
        flashcards: [],
        validationResult,
        error: validationResult.reason || 'Content is insufficient to generate flashcards',
      };
    }

    if (validationResult.minimumFlashcards < 3) {
      return {
        success: false,
        flashcards: [],
        validationResult,
        error: `Content can only generate ${validationResult.minimumFlashcards} flashcards, but at least 3 are required`,
      };
    }

    // Determine actual count (don't exceed what's available)
    const actualCount = Math.min(targetCount, validationResult.minimumFlashcards);

    // Step 2: Generate Flashcards
    const generatedFlashcards = await generateFlashcards(content, actualCount);

    if (generatedFlashcards.length === 0) {
      return {
        success: false,
        flashcards: [],
        validationResult,
        error: 'Failed to generate flashcards',
      };
    }

    // Step 3: Quality Validation
    const qualityCheck = await validateFlashcardQuality(generatedFlashcards, content);

    // Ensure we have at least 3 valid flashcards
    if (qualityCheck.validatedFlashcards.length < 3) {
      return {
        success: false,
        flashcards: qualityCheck.validatedFlashcards,
        validationResult,
        qualityIssues: qualityCheck.issues,
        error: 'Quality validation resulted in fewer than 3 flashcards',
      };
    }

    return {
      success: true,
      flashcards: qualityCheck.validatedFlashcards,
      validationResult,
      qualityIssues: qualityCheck.issues.length > 0 ? qualityCheck.issues : undefined,
    };
  } catch (error: any) {
    console.error('Error in flashcard generation pipeline:', error);
    return {
      success: false,
      flashcards: [],
      validationResult: {
        isValid: false,
        canGenerateMinimum: false,
        minimumFlashcards: 0,
        reason: 'An error occurred during flashcard generation',
      },
      error: error.message || 'Unknown error occurred',
    };
  }
}

