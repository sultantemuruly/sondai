import { getTextContentFromAzure } from './azure';
import { containerClient } from './azure';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Polyfill DOM APIs needed by pdf-parse
if (typeof global !== 'undefined') {
  if (typeof DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor(init?: any) {}
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
  };
  }
  
  if (typeof ImageData === 'undefined') {
  (global as any).ImageData = class ImageData {
    constructor(data: any, width?: number, height?: number) {
      this.data = data;
      this.width = width || 0;
      this.height = height || 0;
    }
    data: any;
    width: number;
    height: number;
  };
  }
  
  if (typeof Path2D === 'undefined') {
  (global as any).Path2D = class Path2D {
    constructor(path?: any) {}
    addPath(path: any, transform?: any) {}
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {}
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {}
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {}
    closePath() {}
    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {}
    lineTo(x: number, y: number) {}
    moveTo(x: number, y: number) {}
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {}
    rect(x: number, y: number, width: number, height: number) {}
  };
  }
}

// Format-specific extractors (lazy-loaded)
let mammoth: any = null;
let JSZip: any = null;
let XLSX: any = null;
let pptx2json: any = null;

/**
 * Extract text from PDF using pdf-parse (lightweight, no Java required)
 * Note: pdf-parse extracts text only. For images, we'd need a more complex solution.
 */
async function extractFromPDF(buffer: Buffer): Promise<{ text: string; imageDescriptions: string[] }> {
  // pdf-parse v1.1.1 uses simple function API - much more reliable!
  const pdfParse = require('pdf-parse');
  const data = await pdfParse(buffer);
  return { text: data.text || '', imageDescriptions: [] };
}

/**
 * Extract text and images from DOCX using mammoth and ZIP parsing
 */
async function extractFromDOCX(buffer: Buffer): Promise<{ text: string; imageDescriptions: string[] }> {
  if (!mammoth) {
    const mammothModule = await import('mammoth');
    mammoth = mammothModule.default || mammothModule;
  }

  if (!JSZip) {
    JSZip = (await import('jszip')).default;
  }

  // Extract text
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value || '';

  // Extract images from DOCX (it's a ZIP file)
  const zip = await JSZip.loadAsync(buffer);
  const imageBuffers: Buffer[] = [];

  for (const fileName in zip.files) {
    if (fileName.startsWith('word/media/') || fileName.startsWith('word/media/')) {
      const file = zip.files[fileName];
      if (!file.dir && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)) {
        const imageData = await file.async('nodebuffer');
        imageBuffers.push(imageData);
      }
    }
  }

  const imageDescriptions = await processImagesWithVision(imageBuffers);
  return { text, imageDescriptions };
}

/**
 * Extract text and images from PPTX using ZIP parsing
 */
async function extractFromPPTX(buffer: Buffer): Promise<{ text: string; imageDescriptions: string[] }> {
  if (!JSZip) {
    JSZip = (await import('jszip')).default;
  }

  const zip = await JSZip.loadAsync(buffer);
  let text = '';
  const imageBuffers: Buffer[] = [];

  // Extract text from slides
  for (const fileName in zip.files) {
    if (fileName.startsWith('ppt/slides/slide') && fileName.endsWith('.xml')) {
      const file = zip.files[fileName];
      const xmlContent = await file.async('string');
      // Simple XML text extraction (remove tags)
      const slideText = xmlContent
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (slideText) {
        text += slideText + '\n\n';
      }
    }

    // Extract images
    if (fileName.startsWith('ppt/media/') || fileName.startsWith('ppt/slides/media/')) {
      if (/\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName)) {
        const file = zip.files[fileName];
        const imageData = await file.async('nodebuffer');
        imageBuffers.push(imageData);
      }
    }
  }

  const imageDescriptions = await processImagesWithVision(imageBuffers);
  return { text: text.trim(), imageDescriptions };
}

/**
 * Extract text from XLSX using xlsx library
 */
async function extractFromXLSX(buffer: Buffer): Promise<{ text: string; imageDescriptions: string[] }> {
  if (!XLSX) {
    XLSX = (await import('xlsx')).default;
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let text = '';

  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    const sheetText = sheetData
      .map((row: any) => Array.isArray(row) ? row.join('\t') : String(row))
      .join('\n');
    text += `\n--- Sheet: ${sheetName} ---\n${sheetText}\n\n`;
  });

  // XLSX doesn't easily extract images, but we could add ZIP parsing if needed
  return { text: text.trim(), imageDescriptions: [] };
}

/**
 * Process images with OpenAI Vision API (GPT-4o with vision)
 */
async function processImagesWithVision(imageBuffers: Buffer[]): Promise<string[]> {
  if (!imageBuffers.length || !openai) {
    return [];
  }

  const descriptions: string[] = [];

  // Process images in batches to avoid rate limits
  for (const imageBuffer of imageBuffers.slice(0, 10)) { // Limit to 10 images per document
    try {
      // Convert to base64
      const base64Image = imageBuffer.toString('base64');
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image (OCR). If it contains diagrams, charts, or visual information, describe them in detail. Focus on educational content that could be used for flashcards.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const description = response.choices[0]?.message?.content || '';
      if (description) {
        descriptions.push(description);
    }
  } catch (error: any) {
      console.warn('Error processing image with Vision API:', error.message);
      // Continue with other images
    }
  }

  return descriptions;
}

/**
 * Main extraction function - supports PDF, DOCX, PPTX, XLSX, and plain text
 */
export async function extractTextFromFile(
  azureBlobName: string,
  fileName: string,
  mimeType?: string
): Promise<string> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  try {
    // Download file from Azure
    const blockBlobClient = containerClient.getBlockBlobClient(azureBlobName);
    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download file from Azure');
    }

    // Collect all chunks into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);

  const lowerFileName = fileName.toLowerCase();
  const lowerMimeType = mimeType?.toLowerCase() || '';

    let result: { text: string; imageDescriptions: string[] };

    // Route to format-specific extractor
  if (
    lowerFileName.endsWith('.pdf') ||
    lowerMimeType === 'application/pdf' ||
    lowerMimeType.includes('pdf')
  ) {
      result = await extractFromPDF(fileBuffer);
  } else if (
    lowerFileName.endsWith('.docx') ||
    lowerMimeType.includes('wordprocessingml') ||
    lowerMimeType.includes('msword')
  ) {
      result = await extractFromDOCX(fileBuffer);
    } else if (
      lowerFileName.endsWith('.pptx') ||
      lowerMimeType.includes('presentationml')
    ) {
      result = await extractFromPPTX(fileBuffer);
    } else if (
      lowerFileName.endsWith('.xlsx') ||
      lowerFileName.endsWith('.xls') ||
      lowerMimeType.includes('spreadsheetml') ||
      lowerMimeType.includes('excel')
    ) {
      result = await extractFromXLSX(fileBuffer);
  } else {
      // Try as plain text
    try {
        const text = await getTextContentFromAzure(azureBlobName);
        return text;
    } catch {
        throw new Error(`Unsupported file type: ${fileName}. Supported formats: PDF, DOCX, PPTX, XLSX, TXT`);
      }
    }

    // Combine text and image descriptions
    let combinedContent = result.text;
    
    if (result.imageDescriptions.length > 0) {
      combinedContent += '\n\n--- Image Content ---\n\n';
      combinedContent += result.imageDescriptions.join('\n\n--- Next Image ---\n\n');
    }

    return combinedContent;
  } catch (error: any) {
    console.error(`Error extracting text from file ${fileName}:`, error);
    throw new Error(`Failed to extract text from ${fileName}: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Legacy functions for backward compatibility
 */
export async function extractTextFromPDF(azureBlobName: string): Promise<string> {
  return extractTextFromFile(azureBlobName, 'file.pdf', 'application/pdf');
}

export async function extractTextFromDOCX(azureBlobName: string): Promise<string> {
  return extractTextFromFile(azureBlobName, 'file.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
