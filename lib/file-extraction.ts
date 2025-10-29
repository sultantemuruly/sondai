import { getTextContentFromAzure } from './azure';
import { containerClient } from './azure';

// Polyfill for DOMMatrix and other canvas APIs needed by pdf-parse
if (typeof global !== 'undefined' && typeof DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor(init?: any) {}
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
  };
  
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

// Dynamic imports for PDF and DOCX parsing (avoids webpack issues)
let pdfParse: any;
let mammoth: any;

/**
 * Extract text content from a PDF file stored in Azure
 */
export async function extractTextFromPDF(azureBlobName: string): Promise<string> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  try {
    const blockBlobClient = containerClient!.getBlockBlobClient(azureBlobName);
    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download PDF from Azure');
    }

    // Collect all chunks into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Lazy load pdf-parse
    // pdf-parse exports a function that can be called directly
    if (!pdfParse) {
      try {
        const pdfParseModule = require('pdf-parse');
        
        // pdf-parse can export in different ways:
        // 1. Direct function: module.exports = function(buffer) {...}
        // 2. Object with default: { default: function }
        // 3. Object with PDFParse class (v2.x)
        
        if (typeof pdfParseModule === 'function') {
          // Traditional pdf-parse API - direct function
          pdfParse = pdfParseModule;
        } else if (pdfParseModule && typeof pdfParseModule === 'object') {
          // Try default export first
          if (typeof pdfParseModule.default === 'function') {
            pdfParse = pdfParseModule.default;
          } else if (pdfParseModule.PDFParse) {
            // v2.x class-based API - use getText() method
            const PDFParseClass = pdfParseModule.PDFParse;
            
            // Configure pdfjs-dist worker for Node.js environment
            // Try to disable or properly configure the worker
            try {
              // Method 1: Use PDFParse.setWorker static method
              if (PDFParseClass.setWorker && typeof PDFParseClass.setWorker === 'function') {
                PDFParseClass.setWorker('');
              }
              
              // Method 2: Configure pdfjs-dist GlobalWorkerOptions directly
              try {
                const pdfjs = require('pdfjs-dist');
                if (pdfjs.GlobalWorkerOptions) {
                  pdfjs.GlobalWorkerOptions.workerSrc = '';
                }
              } catch (pdfjsError) {
                // pdfjs-dist might not be directly accessible, that's okay
              }
            } catch (workerConfigError) {
              console.warn('Could not configure pdf.js worker, will try anyway:', workerConfigError);
            }
            
            pdfParse = async (buffer: Buffer) => {
              try {
                const parser = new PDFParseClass({ data: buffer });
                const textResult = await parser.getText();
                
                // getText() returns { text: string, ... }
                if (textResult && typeof textResult === 'object' && 'text' in textResult) {
                  return textResult;
                }
                return { text: textResult || '' };
              } catch (parseError: any) {
                // Worker errors are common - provide helpful error message
                if (parseError?.message?.includes('worker') || parseError?.message?.includes('worker.mjs')) {
                  throw new Error(`PDF parsing failed: Worker configuration issue. This might be a compatibility issue with pdf-parse v2.x in Next.js. Consider using an alternative PDF parsing library. Original error: ${parseError.message}`);
                }
                throw parseError;
              }
            };
          } else {
            // Last resort: try to use the module itself
            throw new Error(`pdf-parse module format not recognized. Available keys: ${Object.keys(pdfParseModule).join(', ')}`);
          }
        } else {
          throw new Error(`pdf-parse require returned unexpected type: ${typeof pdfParseModule}`);
        }
      } catch (requireError: any) {
        console.error('Failed to require pdf-parse:', requireError);
        throw new Error(`PDF parsing library not available: ${requireError?.message || 'Unknown error'}`);
      }
    }
    
    if (typeof pdfParse !== 'function') {
      throw new Error(`pdf-parse is not a function. Got type: ${typeof pdfParse}`);
    }
    
    // Parse PDF - pdf-parse returns { text: string, numPages: number, ... }
    const result = await pdfParse(pdfBuffer);
    
    // Extract text from result
    if (result && typeof result === 'object' && 'text' in result) {
      return result.text || '';
    } else if (typeof result === 'string') {
      return result;
    } else {
      console.warn('Unexpected pdf-parse return format:', typeof result, Object.keys(result || {}));
      return '';
    }
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    const errorMessage = error?.message || 'Unknown error';
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Extract text content from a DOCX file stored in Azure
 */
export async function extractTextFromDOCX(azureBlobName: string): Promise<string> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  try {
    const blockBlobClient = containerClient!.getBlockBlobClient(azureBlobName);
    const downloadResponse = await blockBlobClient.download();

    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download DOCX from Azure');
    }

    // Collect all chunks into a buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    const docxBuffer = Buffer.concat(chunks);

    // Lazy load mammoth
    if (!mammoth) {
      try {
        const mammothModule = require('mammoth');
        mammoth = mammothModule.default || mammothModule;
      } catch (requireError) {
        console.error('Failed to require mammoth:', requireError);
        throw new Error('DOCX parsing library not available');
      }
    }
    
    // Parse DOCX
    const result = await mammoth.extractRawText({ buffer: docxBuffer });
    return result.value || '';
  } catch (error: any) {
    console.error('Error extracting text from DOCX:', error);
    const errorMessage = error?.message || 'Unknown error';
    throw new Error(`Failed to extract text from DOCX: ${errorMessage}`);
  }
}

/**
 * Extract text from various file types based on file extension or MIME type
 */
export async function extractTextFromFile(
  azureBlobName: string,
  fileName: string,
  mimeType?: string
): Promise<string> {
  const lowerFileName = fileName.toLowerCase();
  const lowerMimeType = mimeType?.toLowerCase() || '';

  // Determine file type
  if (
    lowerFileName.endsWith('.pdf') ||
    lowerMimeType === 'application/pdf' ||
    lowerMimeType.includes('pdf')
  ) {
    return await extractTextFromPDF(azureBlobName);
  } else if (
    lowerFileName.endsWith('.docx') ||
    lowerFileName.endsWith('.doc') ||
    lowerMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerMimeType.includes('wordprocessingml') ||
    lowerMimeType.includes('msword')
  ) {
    return await extractTextFromDOCX(azureBlobName);
  } else {
    // For other file types, try to get as text (might work for plain text files)
    try {
      return await getTextContentFromAzure(azureBlobName);
    } catch {
      throw new Error(`Unsupported file type: ${fileName}. Only PDF and DOCX files are currently supported.`);
    }
  }
}

