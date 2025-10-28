'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface MathFieldElement extends HTMLElement {
  setValue(value: string): void;
  getValue(): string;
}

interface MathEditorDialogProps {
  isOpen: boolean
  onClose: () => void
  onInsert: (latex: string) => void
  initialLatex?: string
}

export function MathEditorDialog({ isOpen, onClose, onInsert, initialLatex = '' }: MathEditorDialogProps) {
  const [latex, setLatex] = useState(initialLatex)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      // Dynamically load MathLive for better performance
      import('mathlive').then((MathLive) => {
        const container = containerRef.current
        if (container) {
          // Create the MathLive input element
          const mf = document.createElement('math-field') as MathFieldElement
          mf.setAttribute('display', 'block')
          mf.style.fontSize = '24px'
          mf.style.minHeight = '100px'
          mf.style.margin = '1rem 0'
          mf.style.padding = '1rem'
          mf.style.border = '2px solid #e5e7eb'
          mf.style.borderRadius = '0.5rem'
          
          if (latex) {
            mf.setValue(latex)
          }
          
          // Update state when value changes
          mf.addEventListener('input', () => {
            setLatex(mf.getValue())
          })
          
          container.innerHTML = ''
          container.appendChild(mf)
          
          // Focus the field
          setTimeout(() => {
            mf.focus()
          }, 100)
        }
      })
    }
  }, [isOpen, latex])

  const handleInsert = () => {
    if (latex.trim()) {
      onInsert(latex)
    }
    onClose()
  }

  const insertLaTeX = (symbol: string) => {
    setLatex((prev) => prev + symbol)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 rounded-t-xl">
          <div className="flex-1 pr-2">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Math Equation Editor</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">Create equations visually like Google Docs!</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="hover:bg-white/80 shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="overflow-y-auto px-4 sm:p-6 pb-4">
          {/* Visual Math Editor */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
              📐 Your Equation:
            </label>
            <div ref={containerRef} className="min-h-[120px] sm:min-h-[150px] border-2 border-blue-200 rounded-lg bg-white p-3 sm:p-4"></div>
            
            <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-600 break-all">
                <strong>LaTeX:</strong> <code className="font-mono text-xs sm:text-sm bg-white px-2 py-1 rounded break-all">{latex || 'Type your equation...'}</code>
              </p>
            </div>
          </div>

          {/* Common Operations */}
          <div className="mb-4 sm:mb-6">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">🔣 Quick Insert:</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {[
                { label: 'Fraction', latex: '\\frac{#?}{#?}', icon: '∕' },
                { label: 'Square', latex: '^{2}', icon: 'x²' },
                { label: 'Square Root', latex: '\\sqrt{#?}', icon: '√' },
                { label: 'Pi', latex: '\\pi', icon: 'π' },
                { label: 'Sum', latex: '\\sum_{#?}^{#?}', icon: '∑' },
                { label: 'Infinity', latex: '\\infty', icon: '∞' },
                { label: 'Integral', latex: '\\int_{#?}^{#?}', icon: '∫' },
                { label: 'Plus', latex: '+', icon: '+' },
                { label: 'Minus', latex: '-', icon: '-' },
                { label: 'Times', latex: '\\times', icon: '×' },
                { label: 'Divide', latex: '\\div', icon: '÷' },
                { label: 'Equals', latex: '=', icon: '=' },
                { label: 'Less Than', latex: '<', icon: '<' },
                { label: 'Greater', latex: '>', icon: '>' },
                { label: 'Alpha', latex: '\\alpha', icon: 'α' },
                { label: 'Beta', latex: '\\beta', icon: 'β' },
                { label: 'Delta', latex: '\\Delta', icon: 'Δ' },
                { label: 'Theta', latex: '\\theta', icon: 'θ' },
                { label: 'Sigma', latex: '\\sigma', icon: 'σ' },
                { label: 'Partial', latex: '\\partial', icon: '∂' },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => insertLaTeX(item.latex + ' ')}
                  className="p-2 sm:p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded transition-all hover:shadow-sm text-center"
                  title={item.label}
                >
                  <span className="text-xl sm:text-2xl font-semibold text-gray-700">{item.icon}</span>
                  <div className="text-[10px] sm:text-xs text-gray-600 mt-1 truncate">{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Examples */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">🚀 Click to Insert:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Quadratic Formula', latex: 'x^{2} + bx + c = 0' },
                { label: 'Pythagorean Theorem', latex: 'a^{2} + b^{2} = c^{2}' },
                { label: 'Einstein Mass-Energy', latex: 'E = mc^{2}' },
                { label: 'Integral Example', latex: '\\int_{0}^{\\infty} e^{-x} dx' },
                { label: 'Fraction Example', latex: '\\frac{a}{b} + \\frac{c}{d}' },
                { label: 'Sum Example', latex: '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}' },
              ].map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => setLatex(ex.latex)}
                  className="text-left px-3 sm:px-4 py-2 bg-white/80 hover:bg-white rounded border border-purple-300 transition-all hover:shadow-sm"
                >
                  <div className="text-xs sm:text-sm font-medium text-purple-700">{ex.label}</div>
                  <div className="text-[10px] sm:text-xs text-gray-600 font-mono truncate">{ex.latex}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleInsert}
            className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            disabled={!latex.trim()}
          >
            Insert Equation
          </Button>
        </div>
      </div>
    </div>
  )
}

