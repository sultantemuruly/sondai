'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ContentItem {
  type: 'note' | 'file' | 'whiteboard'
  id: number
  title: string
}

interface FlashcardGeneratorDialogProps {
  isOpen: boolean
  onClose: () => void
  folderId: number
  availableItems: {
    notes: Array<{ id: number; title: string }>
    files: Array<{ id: number; name: string }>
    whiteboards: Array<{ id: number; title: string }>
  }
  onSuccess?: () => void
}

export function FlashcardGeneratorDialog({
  isOpen,
  onClose,
  folderId,
  availableItems,
  onSuccess,
}: FlashcardGeneratorDialogProps) {
  const [selectedItems, setSelectedItems] = useState<ContentItem[]>([])
  const [groupName, setGroupName] = useState('')
  const [targetCount, setTargetCount] = useState(10)
  const [targetCountInput, setTargetCountInput] = useState('10')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<{
    stage: 'idle' | 'validating' | 'generating' | 'validating-quality' | 'success' | 'error'
    message?: string
  }>({ stage: 'idle' })

  // Combine all available items
  const allItems: ContentItem[] = [
    ...availableItems.notes.map((n) => ({ type: 'note' as const, id: n.id, title: n.title })),
    ...availableItems.files.map((f) => ({ type: 'file' as const, id: f.id, title: f.name })),
    ...availableItems.whiteboards.map((w) => ({ type: 'whiteboard' as const, id: w.id, title: w.title })),
  ]

  const toggleItem = (item: ContentItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.type === item.type && i.id === item.id)
      if (exists) {
        return prev.filter((i) => !(i.type === item.type && i.id === item.id))
      }
      return [...prev, item]
    })
  }

  const handleGenerate = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a name for the flashcard group')
      return
    }

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to generate flashcards from')
      return
    }

    // Validate target count
    const parsedCount = parseInt(targetCountInput)
    if (isNaN(parsedCount) || parsedCount < 3) {
      toast.error('Please enter a number of flashcards that is at least 3')
      return
    }

    setIsGenerating(true)
    setGenerationStatus({ stage: 'validating', message: 'Validating content...' })

    try {
      const response = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folder_id: folderId,
          name: groupName.trim(),
          items: selectedItems,
          target_count: parsedCount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setGenerationStatus({
          stage: 'error',
          message: data.error || 'Failed to generate flashcards',
        })
        toast.error(data.error || 'Failed to generate flashcards')
        return
      }

      setGenerationStatus({
        stage: 'success',
        message: `Successfully generated ${data.flashcards?.length || 0} flashcards!`,
      })

      toast.success(`Generated ${data.flashcards?.length || 0} flashcards!`)
      
      // Reset form
      setSelectedItems([])
      setGroupName('')
      setTargetCount(10)
      setTargetCountInput('10')
      
      // Call success callback
      if (onSuccess) {
        onSuccess()
      }
      
      // Close dialog after a brief delay
      setTimeout(() => {
        onClose()
        setGenerationStatus({ stage: 'idle' })
      }, 1500)
    } catch (error: any) {
      console.error('Error generating flashcards:', error)
      setGenerationStatus({
        stage: 'error',
        message: error.message || 'An error occurred',
      })
      toast.error('Failed to generate flashcards')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Flashcards</DialogTitle>
          <DialogDescription>
            Select items from your folder to generate flashcards from. Our AI will analyze the content and create
            educational flashcards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flashcard Group Name
            </label>
            <Input
              placeholder="e.g., Biology Chapter 1"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          {/* Target Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Flashcards (max)
            </label>
            <Input
              type="number"
              max="50"
              value={targetCountInput}
              onChange={(e) => {
                const value = e.target.value
                setTargetCountInput(value)
                // Parse the number for validation, but allow empty during editing
                if (value === '' || value === '-') {
                  setTargetCount(0)
                } else {
                  const num = parseInt(value)
                  if (!isNaN(num)) {
                    setTargetCount(num)
                  }
                }
              }}
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-1">
              Our AI will generate up to this many flashcards based on content quality (minimum: 3)
            </p>
          </div>

          {/* Available Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Items to Include ({selectedItems.length} selected)
            </label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {allItems.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No items available in this folder. Please add notes, files, or whiteboards first.
                </p>
              ) : (
                allItems.map((item) => {
                  const isSelected = selectedItems.some((i) => i.type === item.type && i.id === item.id)
                  return (
                    <Card
                      key={`${item.type}-${item.id}`}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => !isGenerating && toggleItem(item)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        <FileText className="w-4 h-4 text-gray-500" />
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">{item.title}</p>
                          <p className="text-xs text-gray-500 capitalize">{item.type}</p>
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </div>

          {/* Generation Status */}
          {generationStatus.stage !== 'idle' && (
            <div className="p-4 rounded-lg border-2 border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                {generationStatus.stage === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : generationStatus.stage === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {generationStatus.stage === 'validating'
                      ? 'Validating Content...'
                      : generationStatus.stage === 'generating'
                      ? 'Generating Flashcards...'
                      : generationStatus.stage === 'validating-quality'
                      ? 'Validating Quality...'
                      : generationStatus.stage === 'success'
                      ? 'Success!'
                      : 'Error'}
                  </p>
                  {generationStatus.message && (
                    <p className="text-xs text-gray-600 mt-1">{generationStatus.message}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedItems.length === 0 || !groupName.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Flashcards'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

