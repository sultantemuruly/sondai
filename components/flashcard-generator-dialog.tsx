'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS, formatFileSize, validateCumulativeFileSize } from '@/lib/file-limits'
import { validateUserInstructions } from '@/lib/guardrails'

interface ContentItem {
  type: 'note' | 'file' | 'whiteboard'
  id: number
  title: string
  size?: number
}

interface FlashcardGeneratorDialogProps {
  isOpen: boolean
  onClose: () => void
  folderId: number
  availableItems: {
    notes: Array<{ id: number; title: string }>
    files: Array<{ id: number; name: string; size?: number }>
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
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [instructionsValidation, setInstructionsValidation] = useState<{ isValid: boolean; error?: string }>({ isValid: true })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<{
    stage: 'idle' | 'validating' | 'generating' | 'validating-quality' | 'success' | 'error'
    message?: string
  }>({ stage: 'idle' })

  // Combine all available items with file sizes
  const allItems: ContentItem[] = [
    ...availableItems.notes.map((n) => ({ type: 'note' as const, id: n.id, title: n.title, size: 0 })),
    ...availableItems.files.map((f) => ({ type: 'file' as const, id: f.id, title: f.name, size: f.size || 0 })),
    ...availableItems.whiteboards.map((w) => ({ type: 'whiteboard' as const, id: w.id, title: w.title, size: 0 })),
  ]

  // Calculate cumulative file size for selected files
  const selectedFileSize = selectedItems
    .filter(item => item.type === 'file')
    .reduce((sum, item) => sum + (item.size || 0), 0)

  const sizeValidation = validateCumulativeFileSize(selectedFileSize)

  const toggleItem = (item: ContentItem) => {
    setSelectedItems((prev) => {
      const exists = prev.some((i) => i.type === item.type && i.id === item.id)
      if (exists) {
        return prev.filter((i) => !(i.type === item.type && i.id === item.id))
      }
      return [...prev, item]
    })
  }

  const handleInstructionsChange = (value: string) => {
    setAdditionalInstructions(value)
    if (value.trim().length > 0) {
      const validation = validateUserInstructions(value)
      setInstructionsValidation(validation)
    } else {
      setInstructionsValidation({ isValid: true })
    }
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

    // Validate cumulative file size
    const fileItems = selectedItems.filter(item => item.type === 'file')
    if (fileItems.length > 0) {
      const totalSize = fileItems.reduce((sum, item) => sum + (item.size || 0), 0)
      const validation = validateCumulativeFileSize(totalSize)
      if (!validation.valid) {
        toast.error(validation.error || 'File size limit exceeded')
        return
      }
    }

    // Validate target count
    const parsedCount = parseInt(targetCountInput)
    if (isNaN(parsedCount) || parsedCount < 3) {
      toast.error('Please enter a number of flashcards that is at least 3')
      return
    }

    // Validate additional instructions
    if (additionalInstructions.trim().length > 0) {
      const validation = validateUserInstructions(additionalInstructions)
      if (!validation.isValid) {
        toast.error(validation.error || 'Invalid instructions')
        return
      }
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
          additional_instructions: additionalInstructions.trim() || undefined,
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
      setAdditionalInstructions('')
      setInstructionsValidation({ isValid: true })
      
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

          {/* Additional Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Instructions (Optional)
            </label>
            <textarea
              placeholder="e.g., Only pick very important terms and write their definitions in 2 sentences max"
              value={additionalInstructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              disabled={isGenerating}
              className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              maxLength={50000}
            />
            <div className="flex items-start justify-between mt-1">
              <div className="flex-1">
                {!instructionsValidation.isValid && (
                  <p className="text-xs text-red-600">{instructionsValidation.error}</p>
                )}
                {instructionsValidation.isValid && additionalInstructions.length > 0 && (
                  <p className="text-xs text-green-600">Instructions look good!</p>
                )}
                {additionalInstructions.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Provide specific guidance for flashcard generation (e.g., focus on key concepts, keep definitions brief)
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-400 ml-2">
                {additionalInstructions.length.toLocaleString()}/50,000
              </p>
            </div>
          </div>

          {/* File Size Warning */}
          {selectedItems.some(item => item.type === 'file') && (
            <div className={`p-3 rounded-lg border-2 ${
              sizeValidation.valid
                ? selectedFileSize > MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS * 0.8
                  ? 'border-yellow-300 bg-yellow-50'
                  : 'border-green-300 bg-green-50'
                : 'border-red-300 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Total File Size:
                </span>
                <span className={`text-sm font-bold ${
                  sizeValidation.valid ? 'text-gray-900' : 'text-red-600'
                }`}>
                  {formatFileSize(selectedFileSize)} / {formatFileSize(MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS)}
                </span>
              </div>
              {!sizeValidation.valid && (
                <p className="text-xs text-red-600 mt-1">{sizeValidation.error}</p>
              )}
              {sizeValidation.valid && selectedFileSize > MAX_CUMULATIVE_SIZE_FOR_FLASHCARDS * 0.8 && (
                <p className="text-xs text-yellow-700 mt-1">
                  Approaching file size limit. Consider selecting fewer files.
                </p>
              )}
            </div>
          )}

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
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500 capitalize">{item.type}</p>
                            {item.type === 'file' && item.size && (
                              <span className="text-xs text-gray-400">({formatFileSize(item.size)})</span>
                            )}
                          </div>
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
            disabled={isGenerating || selectedItems.length === 0 || !groupName.trim() || !sizeValidation.valid || !instructionsValidation.isValid}
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

