'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
)

interface Note {
  id: number;
  folder_id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function NoteEditorPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const noteId = params.noteId as string;

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [currentElements, setCurrentElements] = useState<any[]>([]);
  const [currentAppState, setCurrentAppState] = useState<any>({});

  // Memoize the API callback to prevent infinite re-renders
  const handleExcalidrawAPI = useCallback((api: any) => {
    console.log('Excalidraw API received:', api);
    setExcalidrawAPI(api);
  }, []);

  // Memoize the onChange callback
  const handleExcalidrawChange = useCallback((elements: any, appState: any) => {
    console.log('OnChange triggered:', elements.length, 'elements');
    setCurrentElements([...elements]);
    setCurrentAppState(appState);
  }, []);

  useEffect(() => {
    const fetchNote = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/notes/${noteId}`);
        if (response.ok) {
          const data = await response.json();
          setNote(data.note);
          
          // Parse the Excalidraw content
          try {
            const parsedContent = JSON.parse(data.note.content);
            
            // Ensure proper structure with defensive checks
            const sanitizedAppState = {
              ...(parsedContent.appState || {}),
              collaborators: Array.isArray(parsedContent.appState?.collaborators)
                ? parsedContent.appState.collaborators
                : [],
              userToFollow: parsedContent.appState?.userToFollow || null,
            };
            
            const initialData = {
              elements: Array.isArray(parsedContent.elements) ? parsedContent.elements : [],
              appState: sanitizedAppState,
            };
            
            setInitialData(initialData);
            // Initialize current state
            setCurrentElements(initialData.elements);
            setCurrentAppState(initialData.appState);
          } catch (e) {
            console.error('Error parsing note content:', e);
            // If content is empty or invalid, start with empty Excalidraw data
            const emptyData = {
              elements: [],
              appState: {
                collaborators: [],
                userToFollow: null,
                username: user?.firstName || 'User'
              }
            };
            setInitialData(emptyData);
            setCurrentElements([]);
            setCurrentAppState(emptyData.appState);
          }
        }
      } catch (error) {
        console.error('Failed to fetch note:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [user, noteId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log('Saving elements:', currentElements.length, 'elements');
      console.log('Elements:', currentElements);
      console.log('AppState:', currentAppState);
      
      const content = JSON.stringify({ 
        elements: currentElements, 
        appState: currentAppState 
      });

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Saved successfully:', data);
        alert('Note saved!');
      } else {
        const error = await response.json();
        console.error('Failed to save:', error);
        alert('Failed to save note');
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Note not found</h1>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard`}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{note.title}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Excalidraw Editor */}
      <div className="container mx-auto px-6 py-6">
        <div className="bg-white rounded-lg shadow-lg" style={{ height: 'calc(100vh - 200px)' }}>
          {initialData && (
            <Excalidraw
              excalidrawAPI={handleExcalidrawAPI}
              initialData={{
                elements: initialData.elements || [],
                appState: {
                  ...initialData.appState,
                  collaborators: Array.isArray(initialData.appState?.collaborators) 
                    ? initialData.appState.collaborators 
                    : []
                }
              }}
              onChange={handleExcalidrawChange}
              theme="light"
            />
          )}
        </div>
      </div>
    </div>
  )
}

