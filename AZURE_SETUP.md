# Azure Blob Storage Setup Guide

This guide will walk you through setting up Azure Blob Storage for file uploads in your Sondai application.

## Prerequisites

- An Azure account (get one free at https://azure.microsoft.com)
- Basic understanding of Azure services

## Step-by-Step Setup

👉 **Important**: You're on the "Storage accounts" page. Click the **"+ Create"** button (usually at the top left).

### 1. Create an Azure Storage Account

1. Sign in to the [Azure Portal](https://portal.azure.com)
2. In the search bar at the top, type "Storage accounts" and select it
3. Click the **"+ Create"** button
4. Fill in the following information:
   - **Subscription**: Select your subscription
   - **Resource Group**: Create a new one or select existing
     - Name: `sondai-rg` (or your preferred name)
   - **Storage account name**: `sondai{random}`
     - Must be globally unique (3-24 characters, lowercase letters and numbers only)
     - Example: `sondai2024storage`
   - **Region**: Choose the region closest to your users
   - **Performance**: Standard (recommended for cost-effectiveness)
   - **Redundancy**: Locally-redundant storage (LRS) is sufficient for most apps
     - For production, consider Geo-redundant storage (GRS)
5. Click **Review + create**, then click **Create**
6. Wait for the deployment to complete (about 1 minute)

### 2. Get Your Access Keys

1. Once your storage account is created, click **"Go to resource"**
2. In the left sidebar, look for **"Security + networking"** → **"Access keys"**
3. You'll see two access keys. Click **"Show"** next to the first key
4. **Copy the entire connection string** (it looks like):
   ```
   DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
   ```
5. **Save this for your `.env` file**

### 3. Create a Container for Your Files

1. In your Storage Account, go to **"Data storage"** → **"Containers"**
2. Click **"+ Container"**
3. Fill in the details:
   - **Name**: `sondai-files` (this is what's set in the code, but you can change it)
   - **Public access level**: **Private** (recommended for security)
4. Click **"Create"**

### 4. Configure Your Application

1. Open your `.env.local` file (or create one in the root of your project)
2. Add these environment variables:

**Option A: Using Connection String (Easier)**

Simply use the full connection string you copied from Step 2:

```env
# Azure Storage Configuration
AZURE_STORAGE_ACCOUNT_NAME=sondai2024storage  # Your account name
AZURE_STORAGE_ACCOUNT_KEY=DefaultEndpointsProtocol=https;AccountName=sondai2024storage;AccountKey=...;EndpointSuffix=core.windows.net  # Full connection string
AZURE_STORAGE_CONTAINER_NAME=sondai-files
```

**Option B: Using Individual Values**

If you prefer to split them:

```env
AZURE_STORAGE_ACCOUNT_NAME=sondai2024storage
AZURE_STORAGE_ACCOUNT_KEY=your_access_key_here
AZURE_STORAGE_CONTAINER_NAME=sondai-files
```

**Important**: 
- If using Option A, paste the entire connection string as the value for `AZURE_STORAGE_ACCOUNT_KEY`
- If using Option B, use just the AccountKey portion (the long alphanumeric string)
- The connection string should start with `DefaultEndpointsProtocol=https`

**Example `.env.local` file:**

```env
# Database
DATABASE_URL=postgresql://...

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=sondai2024storage
AZURE_STORAGE_ACCOUNT_KEY=DefaultEndpointsProtocol=https;AccountName=sondai2024storage;AccountKey=abc123...;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=sondai-files
```

### 5. Run the Migration

After setting up Azure, you need to run the database migration to create the `files` table:

```bash
npm run migrate
# or
npx drizzle-kit push
```

If you haven't set up the migration yet, you can run:
```bash
npx drizzle-kit push
```

### 6. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to your application and create a folder
3. Try uploading a file
4. Check if the file appears in your Azure Container

## Security Best Practices

### 1. Use SAS (Shared Access Signature) URLs

The application is already configured to use SAS URLs, which provide:
- **Time-limited access** (default: 24 hours)
- **Read-only permissions** for uploaded files
- **User-specific access** (files are stored in `userId/folderId/` structure)

### 2. Private Container

- Your container is set to **Private**, which means files are not publicly accessible
- Only users with valid SAS URLs can access their files
- Each user can only access their own files

### 3. Environment Variables

- Never commit your `.env.local` file to version control
- Add `.env.local` to your `.gitignore` file
- For production, use Azure Key Vault or your hosting platform's secret management

## Troubleshooting

### Error: "Azure Storage is not configured"

- Check that your `.env.local` file exists and has the correct variable names
- Restart your development server after adding environment variables
- Verify the account name and key are correct

### Error: "Container does not exist"

- Make sure you created a container named `sondai-files` (or update the container name in your `.env.local`)
- Check that the storage account is created and accessible

### Files not appearing

- Check your browser's console for errors
- Verify the upload completed successfully in your database
- Check the Azure Portal to see if files are being uploaded

## Cost Estimation

Azure Blob Storage pricing (approximate, as of 2024):
- **Storage**: $0.0184 per GB per month
- **Transactions**: $0.004 per 10,000 transactions
- **Data transfer out**: $0.087 per GB (first 100GB free)

For a typical application:
- 1000 users × 10 files × 5MB average = 50GB
- Monthly cost: ~$1 for storage + minimal transaction costs
- **Total: Less than $5/month for moderate usage**

## Next Steps

1. Consider implementing file preview (for images, PDFs)
2. Add file download functionality
3. Implement file organization features
4. Add file metadata display (file size, type, etc.)
5. Consider adding thumbnails for images

## Support

If you encounter issues:
1. Check the Azure Portal for any errors
2. Review the application logs
3. Verify your SAS token generation is working correctly
4. Test with a small file first to verify connectivity

## Additional Resources

- [Azure Blob Storage Documentation](https://docs.microsoft.com/azure/storage/blobs/)
- [Node.js Azure Storage SDK](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/storage/storage-blob)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

