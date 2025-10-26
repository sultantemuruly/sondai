'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Folder } from 'lucide-react'

interface Folder {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

const Dashboard = () => {
  const { user } = useUser();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFolders = async () => {
      if (!user) return;
      
      try {
        const response = await fetch('/api/folders');
        if (response.ok) {
          const data = await response.json();
          setFolders(data.folders || []);
        }
      } catch (error) {
        console.error('Failed to fetch folders:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolders();
  }, [user]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFolderName }),
      });

      if (response.ok) {
        const data = await response.json();
        setFolders([...folders, data.folder]);
        setNewFolderName('');
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
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
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome, {user.firstName} {user.lastName}
        </h1>
        <p className="text-muted-foreground">Manage your study folders</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Your Folders</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              Create Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Enter a name for your new folder
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div>Loading folders...</div>
      ) : folders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No folders yet. Create one to get started!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder) => (
            <Card key={folder.id} className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-start gap-4">
                <Folder className="w-10 h-10 text-primary mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{folder.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created {formatDate(folder.created_at)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default Dashboard