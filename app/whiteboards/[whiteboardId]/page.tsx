'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Save, ChevronRight, Loader2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import '@excalidraw/excalidraw/index.css'

// Dynamic import to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
)

interface Whiteboard {
  id: number;
  folder_id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function WhiteboardEditorPage() {
  const { user } = useUser();
  const params = useParams();
  const router = useRouter();
  const whiteboardId = params.whiteboardId as string;

  const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
  const [folder, setFolder] = useState<{ id: number; name: string; parent_id: number | null } | null>(null);
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
    const fetchWhiteboard = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/whiteboards/${whiteboardId}`);
        if (response.ok) {
          const data = await response.json();
          setWhiteboard(data.whiteboard);
          
          // Fetch folder info if available
          if (data.whiteboard.folder_id) {
            try {
              const folderResponse = await fetch(`/api/folders/${data.whiteboard.folder_id}`);
              if (folderResponse.ok) {
                const folderData = await folderResponse.json();
                setFolder(folderData.folder);
              }
            } catch (error) {
              console.error('Failed to fetch folder:', error);
            }
          }
          
          // Parse the Excalidraw content
          try {
            const parsedContent = JSON.parse(data.whiteboard.content);
            
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
            console.error('Error parsing whiteboard content:', e);
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
        console.error('Failed to fetch whiteboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWhiteboard();
  }, [user, whiteboardId]);

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

      const response = await fetch(`/api/whiteboards/${whiteboardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Saved successfully:', data);
        alert('Whiteboard saved!');
      } else {
        const error = await response.json();
        console.error('Failed to save:', error);
        alert('Failed to save whiteboard');
      }
    } catch (error) {
      console.error('Failed to save whiteboard:', error);
      alert('Failed to save whiteboard');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <svg className="w-16 h-16 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="loader-gradient-whiteboard" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#9333ea" />
                </linearGradient>
              </defs>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="url(#loader-gradient-whiteboard)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="50" strokeDashoffset="25"/>
            </svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">Loading...</p>
          <p className="text-sm text-muted-foreground mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  if (!whiteboard) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Whiteboard not found</h1>
          <Link href="/dashboard">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href={whiteboard.folder_id ? `/dashboard/${whiteboard.folder_id}` : `/dashboard`}>
                <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-blue-50 hover:text-blue-600">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              {folder && (
                <>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <Link href={`/dashboard/${folder.id}`} className="text-sm text-muted-foreground hover:text-gray-900">
                    {folder.name}
                  </Link>
                </>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">{whiteboard.title}</h1>
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
