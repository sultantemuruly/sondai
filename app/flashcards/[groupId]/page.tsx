'use client'

import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FlashcardViewer } from '@/components/flashcard-viewer'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface FlashcardGroup {
  id: number
  name: string
  folder_id: number
}

interface Flashcard {
  id: number
  flashcard_group_id: number
  term: string
  explanation: string
}

export default function FlashcardGroupPage() {
  const { user } = useUser()
  const params = useParams()
  const router = useRouter()
  const groupId = params.groupId as string

  const [flashcardGroup, setFlashcardGroup] = useState<FlashcardGroup | null>(null)
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFlashcardGroup = async () => {
      if (!user) return

      try {
        const response = await fetch(`/api/flashcards/${groupId}`)
        if (response.ok) {
          const data = await response.json()
          setFlashcardGroup(data.flashcard_group)
          setFlashcards(data.flashcards || [])
        } else {
          console.error('Failed to fetch flashcard group')
        }
      } catch (error) {
        console.error('Error fetching flashcard group:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFlashcardGroup()
  }, [user, groupId])

  const handleUpdateFlashcard = async (id: number, term: string, explanation: string) => {
    try {
      const response = await fetch(`/api/flashcards/${groupId}/flashcards/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ term, explanation }),
      })

      if (!response.ok) {
        throw new Error('Failed to update flashcard')
      }

      const data = await response.json()
      setFlashcards((prev) =>
        prev.map((fc) => (fc.id === id ? { ...fc, term, explanation } : fc))
      )
    } catch (error) {
      throw error
    }
  }

  const handleDeleteFlashcard = async (id: number) => {
    try {
      const response = await fetch(`/api/flashcards/${groupId}/flashcards/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete flashcard')
      }

      setFlashcards((prev) => prev.filter((fc) => fc.id !== id))
    } catch (error) {
      throw error
    }
  }

  const handleDeleteGroup = async () => {
    try {
      const response = await fetch(`/api/flashcards/${groupId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete flashcard group')
      }

      router.push(`/dashboard/${flashcardGroup?.folder_id}`)
    } catch (error) {
      throw error
    }
  }

  const handleRenameGroup = async (name: string) => {
    try {
      const response = await fetch(`/api/flashcards/${groupId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename group')
      }

      const data = await response.json()
      setFlashcardGroup(data.flashcard_group)
    } catch (error) {
      throw error
    }
  }

  if (!user) {
    return <div>Loading...</div>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!flashcardGroup) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Flashcard group not found</h1>
          <Link href="/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/${flashcardGroup.folder_id}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <FlashcardViewer
          flashcardGroup={flashcardGroup}
          flashcards={flashcards}
          onUpdateFlashcard={handleUpdateFlashcard}
          onDeleteFlashcard={handleDeleteFlashcard}
          onDeleteGroup={handleDeleteGroup}
          onRenameGroup={handleRenameGroup}
        />
      </div>
    </div>
  )
}

