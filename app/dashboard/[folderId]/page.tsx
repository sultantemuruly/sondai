'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Folder, Plus, ArrowLeft, Sparkles, FileText, ArrowRight, Trash2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'

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

export default function FolderDetailPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const folderId = params.folderId as string;

  const [folder, setFolder] = useState<Folder | null>(null);
  const [subfolders, setSubfolders] = useState<Folder[]>([]);
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isWhiteboardDialogOpen, setIsWhiteboardDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newWhiteboardTitle, setNewWhiteboardTitle] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'whiteboard' | 'note', id: number } | null>(null);
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

    fetchFolderData();
    fetchWhiteboards();
    fetchNotes();
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

  const handleDelete = (type: 'folder' | 'whiteboard' | 'note', id: number) => {
    setDeleteTarget({ type, id });
    setShowDeleteDialog(true);
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
              {subfolders.length === 0 && whiteboards.length === 0 && notes.length === 0 ? (
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
                    ...notes.map(n => ({ ...n, type: 'note' }))
                  ]
                    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                    .map((item) => {
                      const isWhiteboard = item.type === 'whiteboard';
                      const isNote = item.type === 'note';
                      const isFolder = item.type === 'folder';
                      
                      const colors = [
                        { bg: 'from-orange-500 to-red-500', border: 'hover:border-orange-300', arrow: 'group-hover:text-orange-600' }, // Orange for folders
                        { bg: 'from-blue-500 to-purple-500', border: 'hover:border-blue-300', arrow: 'group-hover:text-blue-600' }, // Blue for whiteboards
                        { bg: 'from-green-500 to-emerald-500', border: 'hover:border-green-300', arrow: 'group-hover:text-green-600' }, // Green for notes
                      ];
                      
                      const colorIndex = isFolder ? 0 : isWhiteboard ? 1 : 2;
                      const color = colors[colorIndex];
                      
                      let displayTitle: string;
                      if ('name' in item) {
                        displayTitle = item.name;
                      } else {
                        displayTitle = item.title;
                      }
                      
                      const updatedDate = isFolder ? item.created_at : item.updated_at;

                      return (
                        <div key={item.id} className="relative group">
                          <Card className={`p-6 hover:shadow-lg transition-all border-2 bg-gradient-to-br from-white to-gray-50 cursor-pointer group ${color.border}`}>
                            <Link href={isFolder ? `/dashboard/${item.id}` : isWhiteboard ? `/whiteboards/${item.id}` : `/notes/${item.id}`}>
                              <div className="flex items-start gap-4 pr-10">
                                <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${color.bg} group-hover:scale-110 transition-transform`}>
                                  {isFolder ? <Folder className="w-6 h-6 text-white" /> : <FileText className="w-6 h-6 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg text-gray-900">{displayTitle}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      isFolder ? 'bg-orange-100 text-orange-700' : 
                                      isWhiteboard ? 'bg-blue-100 text-blue-700' : 
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {isFolder ? 'Folder' : isWhiteboard ? 'Whiteboard' : 'Note'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {isFolder ? 'Created' : 'Updated'} {formatDate(updatedDate)}
                                  </p>
                                </div>
                              </div>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDelete(isFolder ? 'folder' : isWhiteboard ? 'whiteboard' : 'note', item.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </Card>
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
    </div>
  )
}

