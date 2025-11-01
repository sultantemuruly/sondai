'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Edit2, Save, X, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Flashcard {
  id: number
  term: string
  explanation: string
}

interface FlashcardViewerProps {
  flashcardGroup: {
    id: number
    name: string
  }
  flashcards: Flashcard[]
  onUpdateFlashcard: (id: number, term: string, explanation: string) => Promise<void>
  onDeleteFlashcard: (id: number) => Promise<void>
  onDeleteGroup: () => Promise<void>
  onRenameGroup: (name: string) => Promise<void>
}

export function FlashcardViewer({
  flashcardGroup,
  flashcards,
  onUpdateFlashcard,
  onDeleteFlashcard,
  onDeleteGroup,
  onRenameGroup,
}: FlashcardViewerProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTerm, setEditTerm] = useState('')
  const [editExplanation, setEditExplanation] = useState('')
  const [isEditingGroupName, setIsEditingGroupName] = useState(false)
  const [groupName, setGroupName] = useState(flashcardGroup.name)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const currentFlashcard = flashcards[currentIndex]

  // Reset flip state when navigating to a new card
  useEffect(() => {
    setIsFlipped(false)
  }, [currentIndex])

  const startEdit = (flashcard: Flashcard) => {
    setEditingId(flashcard.id)
    setEditTerm(flashcard.term)
    setEditExplanation(flashcard.explanation)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTerm('')
    setEditExplanation('')
  }

  const handleSave = async () => {
    if (!editingId) return

    if (!editTerm.trim() || !editExplanation.trim()) {
      toast.error('Both term and explanation are required')
      return
    }

    setIsUpdating(true)
    try {
      await onUpdateFlashcard(editingId, editTerm.trim(), editExplanation.trim())
      toast.success('Flashcard updated!')
      setEditingId(null)
      setEditTerm('')
      setEditExplanation('')
    } catch (error: any) {
      toast.error(error.message || 'Failed to update flashcard')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this flashcard?')) return

    setIsDeleting(true)
    try {
      await onDeleteFlashcard(id)
      toast.success('Flashcard deleted!')
      if (currentIndex >= flashcards.length - 1) {
        setCurrentIndex(Math.max(0, flashcards.length - 2))
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete flashcard')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRenameGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Group name cannot be empty')
      return
    }

    try {
      await onRenameGroup(groupName.trim())
      setIsEditingGroupName(false)
      toast.success('Group renamed!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to rename group')
    }
  }

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this flashcard group? This will delete all flashcards in it.')) {
      return
    }

    try {
      await onDeleteGroup()
      toast.success('Flashcard group deleted!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete group')
    }
  }

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No flashcards in this group</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {isEditingGroupName ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameGroup()
                if (e.key === 'Escape') {
                  setIsEditingGroupName(false)
                  setGroupName(flashcardGroup.name)
                }
              }}
              className="flex-1"
              autoFocus
            />
            <Button size="sm" onClick={handleRenameGroup}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setIsEditingGroupName(false)
              setGroupName(flashcardGroup.name)
            }}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{flashcardGroup.name}</h1>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsEditingGroupName(true)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteGroup}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="text-sm text-gray-500">
          {currentIndex + 1} / {flashcards.length}
        </div>
      </div>

      {/* Flashcard Display */}
      <div className="relative">
        <div className="perspective-1000 mx-auto max-w-2xl">
          <div 
            className="relative w-full h-[500px] preserve-3d cursor-pointer"
            onClick={() => editingId !== currentFlashcard.id && setIsFlipped(!isFlipped)}
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {editingId === currentFlashcard.id ? (
              <Card className="p-8 h-full flex items-center justify-center backface-hidden">
                <div className="w-full space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Term</label>
                    <Input
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      placeholder="Enter term or question"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
                    <textarea
                      value={editExplanation}
                      onChange={(e) => setEditExplanation(e.target.value)}
                      placeholder="Enter explanation or answer"
                      className="w-full min-h-[200px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={isUpdating} size="sm">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button onClick={cancelEdit} variant="outline" size="sm">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <>
                {/* Front of card - Term */}
                <Card 
                  className="absolute inset-0 p-8 flex flex-col items-center justify-center backface-hidden shadow-2xl rounded-xl"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)',
                    background: 'linear-gradient(135deg, #4c51bf 0%, #553c9a 100%)',
                    color: 'white',
                    border: 'none',
                  }}
                >
                  <div className="text-center w-full">
                    <p className="text-sm text-white/80 mb-4 font-medium">Term</p>
                    <p className="text-3xl md:text-4xl font-bold text-white leading-tight">
                      {currentFlashcard.term}
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-2 text-white/70 text-sm font-medium animate-pulse">
                      <RotateCw className="w-4 h-4" />
                      <span>Click anywhere to flip</span>
                    </div>
                  </div>
                </Card>

                {/* Back of card - Explanation */}
                <Card 
                  className="absolute inset-0 p-8 flex flex-col items-center justify-center backface-hidden shadow-2xl rounded-xl"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'linear-gradient(135deg, #c026d3 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                  }}
                >
                  <div className="text-center w-full max-h-full overflow-y-auto">
                    <p className="text-sm text-white/80 mb-4 font-medium">Explanation</p>
                    <p className="text-xl md:text-2xl text-white whitespace-pre-wrap leading-relaxed">
                      {currentFlashcard.explanation}
                    </p>
                    <div className="mt-8 flex items-center justify-center gap-2 text-white/70 text-sm font-medium animate-pulse">
                      <RotateCw className="w-4 h-4" />
                      <span>Click anywhere to flip back</span>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>

        {editingId !== currentFlashcard.id && (
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                startEdit(currentFlashcard)
              }}
              className="bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(currentFlashcard.id)
              }}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-white/90 backdrop-blur-sm shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => {
            setCurrentIndex((prev) => Math.max(0, prev - 1))
            setIsFlipped(false)
          }}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>

        <div className="flex gap-1">
          {flashcards.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentIndex(index)
                setIsFlipped(false)
              }}
              className={`w-2 h-2 rounded-full ${
                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setCurrentIndex((prev) => Math.min(flashcards.length - 1, prev + 1))
            setIsFlipped(false)
          }}
          disabled={currentIndex === flashcards.length - 1}
        >
          Next
        </Button>
      </div>

      {/* Flashcard List */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-4">All Flashcards</h2>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {flashcards.map((flashcard, index) => (
            <Card
              key={flashcard.id}
              className={`p-4 cursor-pointer transition-all ${
                index === currentIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
              onClick={() => {
                setCurrentIndex(index)
                setIsFlipped(false)
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">{flashcard.term}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{flashcard.explanation}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(flashcard)
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(flashcard.id)
                    }}
                    disabled={isDeleting}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

