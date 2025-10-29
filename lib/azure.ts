import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';

const AZURE_STORAGE_ACCOUNT_NAME = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const AZURE_STORAGE_ACCOUNT_KEY = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'sondai-files';

// Parse account key from connection string if needed
function getAccountKey(): string | undefined {
  if (!AZURE_STORAGE_ACCOUNT_KEY) return undefined;
  
  // If it's a connection string, extract the AccountKey
  if (AZURE_STORAGE_ACCOUNT_KEY.includes('AccountKey=')) {
    const keyMatch = AZURE_STORAGE_ACCOUNT_KEY.match(/AccountKey=([^;]+)/);
    return keyMatch ? keyMatch[1] : AZURE_STORAGE_ACCOUNT_KEY;
  }
  
  return AZURE_STORAGE_ACCOUNT_KEY;
}

const parsedAccountKey = getAccountKey();

if (!AZURE_STORAGE_ACCOUNT_NAME || !parsedAccountKey) {
  console.warn('Azure Storage credentials not configured. File upload will not work.');
}

// Initialize Azure Blob Service Client
export const blobServiceClient = AZURE_STORAGE_ACCOUNT_NAME && parsedAccountKey && AZURE_STORAGE_ACCOUNT_KEY
  ? BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_ACCOUNT_KEY.startsWith('DefaultEndpointsProtocol')
        ? AZURE_STORAGE_ACCOUNT_KEY // If it's already a connection string, use it as is
        : `DefaultEndpointsProtocol=https;AccountName=${AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${parsedAccountKey};EndpointSuffix=core.windows.net`
    ) as BlobServiceClient
  : null;

export const containerClient = blobServiceClient?.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);

/**
 * Generate a SAS (Shared Access Signature) URL for accessing a blob
 * This provides secure, time-limited access to the file
 */
export function generateSASUrl(blobName: string, expiryInHours: number = 24): string {
  if (!AZURE_STORAGE_ACCOUNT_NAME || !parsedAccountKey || !containerClient || !blobServiceClient) {
    throw new Error('Azure Storage is not configured');
  }

  const blobClient = containerClient.getBlobClient(blobName);
  
  const sharedKeyCredential = new StorageSharedKeyCredential(
    AZURE_STORAGE_ACCOUNT_NAME!,
    parsedAccountKey!
  );

  const expiryTime = new Date();
  expiryTime.setTime(expiryTime.getTime() + expiryInHours * 60 * 60 * 1000);

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: AZURE_STORAGE_CONTAINER_NAME,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only permission
      startsOn: new Date(),
      expiresOn: expiryTime,
    },
    sharedKeyCredential
  ).toString();

  // Return the URL with SAS token
  return `${blobClient.url}?${sasToken}`;
}

/**
 * Upload a file to Azure Blob Storage
 */
export async function uploadFileToAzure(
  file: File,
  userId: number,
  folderId: number
): Promise<{ blobName: string; url: string }> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  // Generate unique blob name: userId/folderId/filename_timestamp.ext
  const timestamp = Date.now();
  const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const blobName = `${userId}/${folderId}/${timestamp}_${sanitizedFilename}`;

  // Upload the file
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  const buffer = Buffer.from(await file.arrayBuffer());
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: file.type || 'application/octet-stream',
    },
  });

  // Generate SAS URL for secure access
  const url = generateSASUrl(blobName);

  return { blobName, url };
}

/**
 * Delete a file from Azure Blob Storage
 */
export async function deleteFileFromAzure(blobName: string): Promise<void> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.deleteIfExists();
}

/**
 * Upload text content to Azure Blob Storage (for notes and whiteboards)
 */
export async function uploadTextContentToAzure(
  content: string,
  userId: number,
  folderId: number,
  type: 'note' | 'whiteboard' | 'flashcard_group',
  itemId?: number
): Promise<{ blobName: string; url: string }> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  const timestamp = Date.now();
  const uniqueId = itemId || timestamp;
  const blobName = `${type}s/${userId}/${folderId}/${uniqueId}.json`;

  // Convert content to buffer
  const buffer = Buffer.from(content, 'utf-8');

  // Upload the content
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(buffer, buffer.length, {
    blobHTTPHeaders: {
      blobContentType: 'application/json',
    },
  });

  // Generate SAS URL for secure access
  const url = generateSASUrl(blobName);

  return { blobName, url };
}

/**
 * Get text content from Azure Blob Storage
 */
export async function getTextContentFromAzure(blobName: string): Promise<string> {
  if (!containerClient) {
    throw new Error('Azure Storage is not configured');
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const downloadResponse = await blockBlobClient.download();
  
  if (!downloadResponse.readableStreamBody) {
    throw new Error('Failed to download blob content');
  }

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(Buffer.from(chunk));
  }
  
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Delete text content from Azure Blob Storage
 */
export async function deleteTextContentFromAzure(blobName: string): Promise<void> {
  return deleteFileFromAzure(blobName);
}

