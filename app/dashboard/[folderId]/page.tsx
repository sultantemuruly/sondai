'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Folder, Plus, ArrowLeft, Sparkles, FileText, ArrowRight, Trash2, Upload, File, Brain, Maximize2, Minimize2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FlashcardGeneratorDialog } from '@/components/flashcard-generator-dialog'
import { MAX_FILE_SIZE, formatFileSize } from '@/lib/file-limits'

interface Folder {
  id: number;
  user_id: number;
  parent_id: number | null;
  name: string;
  created_at: string;
  type?: 'folder';
}

interface Whiteboard {
  id: number;
  folder_id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  type?: 'whiteboard';
}

interface Note {
  id: number;
  folder_id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  type?: 'note';
}

interface UploadedFile {
  id: number;
  folder_id: number;
  user_id: number;
  name: string;
  original_name: string;
  file_type: string;
  size: number;
  azure_blob_name: string;
  url: string;
  created_at: string;
  updated_at: string;
  type?: 'file';
}

interface FlashcardGroup {
  id: number;
  folder_id: number;
  user_id: number;
  name: string;
  flashcard_count: number;
  created_at: string;
  updated_at: string;
  type?: 'flashcard_group';
}

// Helper function to check if a file is an Office file (DOCX, PPTX, XLSX)
function isOfficeFile(file: UploadedFile | null): boolean {
  if (!file || !file.original_name || !file.file_type) {
    return false;
  }
  
  const lowerName = file.original_name.toLowerCase();
  const lowerType = file.file_type.toLowerCase();
  
  return (
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.pptx') ||
    lowerName.endsWith('.ppt') ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerType.includes('wordprocessingml') ||
    lowerType.includes('presentationml') ||
    lowerType.includes('spreadsheetml') ||
    lowerType.includes('msword') ||
    lowerType.includes('excel') ||
    lowerType.includes('powerpoint')
  );
}

// Helper function to check if a file type is supported for viewing/processing
function isSupportedFileType(file: File): boolean {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  // Supported file extensions
  const supportedExtensions = [
    // Documents
    '.pdf', '.docx', '.doc', '.txt', '.rtf',
    // Presentations
    '.pptx', '.ppt',
    // Spreadsheets
    '.xlsx', '.xls',
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif',
    // Videos (we support viewing but not full processing yet)
    '.mp4', '.mov', '.avi',
    // Audio
    '.mp3', '.wav', '.m4a',
  ];
  
  // Check by extension
  const hasSupportedExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
  
  // Check by MIME type
  const supportedMimeTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    // Presentations
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
    // Videos
    'video/mp4', 'video/quicktime', 'video/x-msvideo',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/mp4',
  ];
  
  const hasSupportedMimeType = supportedMimeTypes.some(mime => fileType.includes(mime));
  
  return hasSupportedExtension || hasSupportedMimeType || fileType.startsWith('image/');
}

export default function FolderDetailPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId as string;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [flashcardGroups, setFlashcardGroups] = useState<FlashcardGroup[]>([]);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isWhiteboardDialogOpen, setIsWhiteboardDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isFileUploadDialogOpen, setIsFileUploadDialogOpen] = useState(false);
  const [isFlashcardGeneratorOpen, setIsFlashcardGeneratorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [isFileViewerOpen, setIsFileViewerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newWhiteboardTitle, setNewWhiteboardTitle] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'whiteboard' | 'note' | 'file' | 'flashcard_group', id: number } | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const fetchFolderData = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/folders/${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setFolder(data.folder);
          setSubfolders(data.subfolders || []);
        }
      } catch (error) {
        console.error('Failed to fetch folder:', error);
      }
    };

    const fetchWhiteboards = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/whiteboards?folder_id=${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setWhiteboards(data.whiteboards || []);
        }
      } catch (error) {
        console.error('Failed to fetch whiteboards:', error);
      }
    };

    const fetchNotes = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/notes?folder_id=${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setNotes(data.notes || []);
        }
      } catch (error) {
        console.error('Failed to fetch notes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchFiles = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/files?folder_id=${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setUploadedFiles(data.files || []);
        }
      } catch (error) {
        console.error('Failed to fetch files:', error);
      }
    };

    const fetchFlashcardGroups = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/flashcards?folder_id=${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setFlashcardGroups(data.flashcard_groups || []);
        }
      } catch (error) {
        console.error('Failed to fetch flashcard groups:', error);
      }
    };

    fetchFolderData();
    fetchWhiteboards();
    fetchNotes();
    fetchFiles();
    fetchFlashcardGroups();
  }, [user, folderId]);

  const handleCreateSubfolder = async () => {
    if (!newFolderName.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newFolderName,
          parent_id: parseInt(folderId)
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubfolders([...subfolders, data.folder]);
        setNewFolderName('');
        setIsFolderDialogOpen(false);
        toast.success('Subfolder created successfully!');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      toast.error('Failed to create subfolder');
    }
  };

  const handleCreateWhiteboard = async () => {
    if (!newWhiteboardTitle.trim()) {
      return;
    }

    // Create empty Excalidraw data
    const emptyContent = JSON.stringify({ elements: [], appState: {} });

    try {
      const response = await fetch('/api/whiteboards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          folder_id: parseInt(folderId),
          title: newWhiteboardTitle,
          content: emptyContent
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setWhiteboards([...whiteboards, data.whiteboard]);
        setNewWhiteboardTitle('');
        setIsWhiteboardDialogOpen(false);
        toast.success('Whiteboard created successfully!');
        // Navigate to the whiteboard editor
        router.push(`/whiteboards/${data.whiteboard.id}`);
      }
    } catch (error) {
      console.error('Failed to create whiteboard:', error);
      toast.error('Failed to create whiteboard');
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) {
      return;
    }

    // Create empty TipTap content
    const emptyContent = JSON.stringify({ type: 'doc', content: [] });

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          folder_id: parseInt(folderId),
          title: newNoteTitle,
          content: emptyContent
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNotes([...notes, data.note]);
        setNewNoteTitle('');
        setIsNoteDialogOpen(false);
        toast.success('Note created successfully!');
        // Navigate to the note editor
        router.push(`/notes/${data.note.id}`);
      }
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note');
    }
  };

  const handleDelete = (type: 'folder' | 'whiteboard' | 'note' | 'file' | 'flashcard_group', id: number) => {
    setDeleteTarget({ type, id });
    setShowDeleteDialog(true);
  };

  const handleFlashcardGenerationSuccess = async () => {
    // Refetch flashcard groups
    try {
      const response = await fetch(`/api/flashcards?folder_id=${folderId}`);
      if (response.ok) {
        const data = await response.json();
        setFlashcardGroups(data.flashcard_groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch flashcard groups:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Check file size first
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `File too large`,
        {
          description: `File size (${formatFileSize(file.size)}) exceeds the maximum limit of ${formatFileSize(MAX_FILE_SIZE)}. Please upload a smaller file.`,
          duration: 6000,
        }
      );
      // Reset the file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      return;
    }

    // Check if file type is supported
    if (!isSupportedFileType(file)) {
      const fileExtension = file.name.split('.').pop()?.toUpperCase() || 'UNKNOWN';
      toast.error(
        `Unsupported file type: .${fileExtension}`,
        {
          description: 'Supported formats: PDF, DOCX, PPTX, XLSX, Images (JPG, PNG, GIF, etc.), Videos (MP4, MOV), Audio (MP3, WAV), and Text files (TXT). You can still download unsupported files, but they cannot be previewed or used for flashcard generation.',
          duration: 6000,
        }
      );
      // Reset the file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_id', folderId);

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadedFiles([...uploadedFiles, data.file]);
        setIsFileUploadDialogOpen(false);
        toast.success('File uploaded successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      let endpoint = '';
      switch (deleteTarget.type) {
        case 'folder':
          endpoint = `/api/folders/${deleteTarget.id}`;
          break;
        case 'whiteboard':
          endpoint = `/api/whiteboards/${deleteTarget.id}`;
          break;
        case 'note':
          endpoint = `/api/notes/${deleteTarget.id}`;
          break;
        case 'file':
          endpoint = `/api/files/${deleteTarget.id}`;
          break;
        case 'flashcard_group':
          endpoint = `/api/flashcards/${deleteTarget.id}`;
          break;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (response.ok) {
        switch (deleteTarget.type) {
          case 'folder':
            setSubfolders(subfolders.filter(f => f.id !== deleteTarget.id));
            break;
          case 'whiteboard':
            setWhiteboards(whiteboards.filter(w => w.id !== deleteTarget.id));
            break;
          case 'note':
            setNotes(notes.filter(n => n.id !== deleteTarget.id));
            break;
          case 'file':
            setUploadedFiles(uploadedFiles.filter(f => f.id !== deleteTarget.id));
            break;
          case 'flashcard_group':
            setFlashcardGroups(flashcardGroups.filter(fg => fg.id !== deleteTarget.id));
            break;
        }
        toast.success(`${deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1)} deleted successfully!`);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error(`Failed to delete ${deleteTarget?.type || 'item'}`);
    } finally {
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Sondai
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Folder Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Folder className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {folder?.name || 'Loading...'}
              </h1>
              <p className="text-muted-foreground">
                {folder && `Created ${formatDate(folder.created_at)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex gap-4 mb-8">
          <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="w-5 h-5" />
                Create Subfolder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Subfolder</DialogTitle>
                <DialogDescription>
                  Enter a name for your new subfolder
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Subfolder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSubfolder();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubfolder}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="outline">
                <Plus className="w-5 h-5" />
                Create Note
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Note</DialogTitle>
                <DialogDescription>
                  Add a new note to this folder
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Note title"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateNote();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNote}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isFileUploadDialogOpen} onOpenChange={setIsFileUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="outline">
                <Upload className="w-5 h-5" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File</DialogTitle>
                <DialogDescription>
                  Upload a file to this folder. Maximum file size: {formatFileSize(MAX_FILE_SIZE)}. Supported formats can be previewed and used for flashcard generation.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                  disabled={uploading}
                />
                <label htmlFor="file-upload">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors">
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="text-sm text-muted-foreground">Uploading...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm font-medium text-gray-900 mb-2">Click to upload</p>
                        <p className="text-xs text-muted-foreground mb-1">
                          <strong>Supported:</strong> PDF, DOCX, PPTX, XLSX, Images, Videos, Audio, TXT
                        </p>
                        <p className="text-xs text-muted-foreground">Max file size: 100MB</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFileUploadDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isFlashcardGeneratorOpen} onOpenChange={setIsFlashcardGeneratorOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                <Brain className="w-5 h-5" />
                Generate Flashcards
              </Button>
            </DialogTrigger>
            <FlashcardGeneratorDialog
              isOpen={isFlashcardGeneratorOpen}
              onClose={() => setIsFlashcardGeneratorOpen(false)}
              folderId={parseInt(folderId)}
              availableItems={{
                notes,
                files: uploadedFiles,
                whiteboards,
              }}
              onSuccess={handleFlashcardGenerationSuccess}
            />
          </Dialog>

          <Dialog open={isWhiteboardDialogOpen} onOpenChange={setIsWhiteboardDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="outline">
                <Plus className="w-5 h-5" />
                Create Whiteboard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Whiteboard</DialogTitle>
                <DialogDescription>
                  Add a new whiteboard to this folder
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Whiteboard title"
                  value={newWhiteboardTitle}
                  onChange={(e) => setNewWhiteboardTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateWhiteboard();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWhiteboardDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateWhiteboard}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Combined All Items Section */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">All Items</h2>
              {subfolders.length === 0 && whiteboards.length === 0 && notes.length === 0 && uploadedFiles.length === 0 && flashcardGroups.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No items yet</h3>
                  <p className="text-muted-foreground mb-6">Create your first folder, whiteboard or note to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Combine all items and sort by updated_at */}
                  {[
                    ...subfolders.map(f => ({ ...f, type: 'folder', updated_at: f.created_at })),
                    ...whiteboards.map(w => ({ ...w, type: 'whiteboard' })),
                    ...notes.map(n => ({ ...n, type: 'note' })),
                    ...uploadedFiles.map(f => ({ ...f, type: 'file', title: f.name, updated_at: f.created_at })),
                    ...flashcardGroups.map(fg => ({ ...fg, type: 'flashcard_group', title: fg.name, updated_at: fg.updated_at }))
                  ]
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .map((item) => {
                      const isWhiteboard = item.type === 'whiteboard';
                      const isNote = item.type === 'note';
                      const isFolder = item.type === 'folder';
                      const isFile = item.type === 'file';
                      const isFlashcardGroup = item.type === 'flashcard_group';
                      
                      const colors = [
                        { bg: 'from-orange-500 to-red-500', border: 'hover:border-orange-300', arrow: 'group-hover:text-orange-600' }, // Orange for folders
                        { bg: 'from-blue-500 to-purple-500', border: 'hover:border-blue-300', arrow: 'group-hover:text-blue-600' }, // Blue for whiteboards
                        { bg: 'from-green-500 to-emerald-500', border: 'hover:border-green-300', arrow: 'group-hover:text-green-600' }, // Green for notes
                        { bg: 'from-purple-500 to-pink-500', border: 'hover:border-purple-300', arrow: 'group-hover:text-purple-600' }, // Purple for files
                        { bg: 'from-indigo-500 to-purple-500', border: 'hover:border-indigo-300', arrow: 'group-hover:text-indigo-600' }, // Indigo for flashcard groups
                      ];
                      
                      const colorIndex = isFolder ? 0 : isWhiteboard ? 1 : isNote ? 2 : isFile ? 3 : 4;
                      const color = colors[colorIndex];
                      
                      let displayTitle: string;
                      if ('name' in item) {
                        displayTitle = item.name;
                      } else {
                        displayTitle = item.title;
                      }
                      
                      const updatedDate = isFolder ? item.created_at : item.updated_at;

                      return (
                        <div key={`${item.type}-${item.id}`} className="relative group">
                          {isFile ? (
                            <>
                              <div 
                                className="block"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedFile(item as UploadedFile);
                                  setIsFileViewerOpen(true);
                                }}
                              >
                                <Card className={`p-6 hover:shadow-lg transition-all border-2 bg-gradient-to-br from-white to-gray-50 cursor-pointer group ${color.border}`}>
                                  <div className="flex items-start gap-4 pr-10">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${color.bg} group-hover:scale-110 transition-transform`}>
                                      <File className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-gray-900">{displayTitle}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700`}>
                                          File
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        Uploaded {formatDate(updatedDate)}
                                      </p>
                                    </div>
                                  </div>
                                </Card>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleDelete('file', item.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Link href={
                                isFolder 
                                  ? `/dashboard/${item.id}` 
                                  : isWhiteboard 
                                  ? `/whiteboards/${item.id}` 
                                  : isNote
                                  ? `/notes/${item.id}`
                                  : isFlashcardGroup
                                  ? `/flashcards/${item.id}`
                                  : '#'
                              }>
                                <Card className={`p-6 hover:shadow-lg transition-all border-2 bg-gradient-to-br from-white to-gray-50 cursor-pointer group ${color.border}`}>
                                  <div className="flex items-start gap-4 pr-10">
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${color.bg} group-hover:scale-110 transition-transform`}>
                                      {isFolder ? <Folder className="w-6 h-6 text-white" /> : isFlashcardGroup ? <Brain className="w-6 h-6 text-white" /> : <FileText className="w-6 h-6 text-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-lg text-gray-900">{displayTitle}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                          isFolder ? 'bg-orange-100 text-orange-700' : 
                                          isWhiteboard ? 'bg-blue-100 text-blue-700' : 
                                          isNote ? 'bg-green-100 text-green-700' :
                                          isFlashcardGroup ? 'bg-indigo-100 text-indigo-700' :
                                          'bg-purple-100 text-purple-700'
                                        }`}>
                                          {isFolder ? 'Folder' : isWhiteboard ? 'Whiteboard' : isNote ? 'Note' : isFlashcardGroup ? 'Flashcards' : 'File'}
                                        </span>
                                        {isFlashcardGroup && 'flashcard_count' in item && (
                                          <span className="text-xs text-gray-500">
                                            ({item.flashcard_count} cards)
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {isFolder ? 'Created' : 'Updated'} {formatDate(updatedDate)}
                                      </p>
                                    </div>
                                  </div>
                                </Card>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 z-10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  handleDelete(
                                    isFolder 
                                      ? 'folder' 
                                      : isWhiteboard 
                                      ? 'whiteboard' 
                                      : isNote
                                      ? 'note'
                                      : isFlashcardGroup
                                      ? 'flashcard_group'
                                      : 'file', 
                                    item.id
                                  );
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {deleteTarget?.type || 'item'} and all its contents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Viewer Modal */}
      <Dialog open={isFileViewerOpen} onOpenChange={(open) => {
        setIsFileViewerOpen(open);
        if (!open) setIsFullscreen(false);
      }}>
        {isFullscreen ? (
          // Fullscreen mode - edge to edge with two-page view for PDFs
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Fullscreen Header */}
            <div className="flex items-center justify-between p-4 bg-black/90 border-b border-gray-800">
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-semibold truncate">{selectedFile?.name}</h2>
                <p className="text-gray-400 text-sm truncate">{selectedFile?.original_name}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(false)}
                className="shrink-0 text-white hover:bg-white/10"
              >
                <Minimize2 className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Fullscreen Content */}
            {selectedFile && (
              <div className="flex-1 overflow-hidden">
                {selectedFile.file_type.startsWith('image/') ? (
                  // Fullscreen image view - centered and maximized
                  <div className="w-full h-full flex items-center justify-center bg-black p-4">
                    <img 
                      src={selectedFile.url} 
                      alt={selectedFile.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      style={{ maxWidth: '100vw', maxHeight: 'calc(100vh - 80px)' }}
                    />
                  </div>
                ) : selectedFile.file_type === 'application/pdf' || selectedFile.original_name.toLowerCase().endsWith('.pdf') ? (
                  // Two-page view for PDFs in fullscreen
                  <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2 bg-gray-900">
                    <div className="flex-1 min-w-0">
                      <iframe
                        src={selectedFile.url}
                        className="w-full h-full rounded border border-gray-700"
                        title={`${selectedFile.name} - Page 1`}
                      />
                    </div>
                    <div className="hidden md:block flex-1 min-w-0">
                      <iframe
                        src={`${selectedFile.url}#page=2`}
                        className="w-full h-full rounded border border-gray-700"
                        title={`${selectedFile.name} - Page 2`}
                      />
                    </div>
                  </div>
                ) : isOfficeFile(selectedFile) ? (
                  <iframe
                    src={
                      selectedFile.original_name.toLowerCase().endsWith('.pptx') || selectedFile.original_name.toLowerCase().endsWith('.ppt')
                        ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(selectedFile.url)}`
                        : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(selectedFile.url)}`
                    }
                    className="w-full h-full"
                    title={selectedFile.name}
                    frameBorder="0"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white">
                    <File className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-lg font-medium mb-2">{selectedFile.original_name}</p>
                    <p className="text-sm text-gray-400 mb-6">Preview not available</p>
                    <a
                      href={selectedFile.url}
                      download={selectedFile.original_name}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="secondary">Download File</Button>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Normal modal mode
          <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <DialogHeader className="flex flex-row items-center justify-between pr-8">
              <div>
                <DialogTitle>{selectedFile?.name}</DialogTitle>
                <DialogDescription>
                  {selectedFile?.original_name}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                {(selectedFile && (
                  selectedFile.file_type.startsWith('image/') ||
                  selectedFile.file_type === 'application/pdf' || 
                  selectedFile.original_name.toLowerCase().endsWith('.pdf') || 
                  isOfficeFile(selectedFile)
                )) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="shrink-0"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </DialogHeader>
            
            {selectedFile && (
              <div className="flex-1 overflow-auto mt-4">
                {selectedFile.file_type.startsWith('image/') ? (
                  <img 
                    src={selectedFile.url} 
                    alt={selectedFile.name}
                    className="w-full h-auto rounded-lg"
                  />
                ) : selectedFile.file_type === 'application/pdf' || selectedFile.original_name.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={selectedFile.url}
                    className="w-full h-[70vh] rounded-lg border"
                    title={selectedFile.name}
                  />
                ) : isOfficeFile(selectedFile) ? (
                  <iframe
                    src={
                      selectedFile.original_name.toLowerCase().endsWith('.pptx') || selectedFile.original_name.toLowerCase().endsWith('.ppt')
                        ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(selectedFile.url)}`
                        : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(selectedFile.url)}`
                    }
                    className="w-full h-[70vh] rounded-lg border"
                    title={selectedFile.name}
                    frameBorder="0"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <File className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-900 mb-2">
                      {selectedFile.original_name}
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Preview not available for this file type
                    </p>
                    <a
                      href={selectedFile.url}
                      download={selectedFile.original_name}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button>
                        Download File
                      </Button>
                    </a>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

