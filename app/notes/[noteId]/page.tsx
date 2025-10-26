'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { ArrowLeft, Save, Bold, Italic, Underline, Highlighter, Palette, Type, Calculator, Plus, Minus, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExtension from '@tiptap/extension-underline'
import LinkExtension from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import { Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Link as LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

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
  const noteId = params.noteId as string;

  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [mathEquation, setMathEquation] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#000000');
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);
  const mathFieldRef = useRef<any>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      UnderlineExtension,
      Highlight.configure({ multicolor: true }),
      TextStyle.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            fontSize: {
              default: null,
              parseHTML: element => element.style.fontSize,
              renderHTML: attributes => {
                if (!attributes.fontSize) {
                  return {};
                }
                return {
                  style: `font-size: ${attributes.fontSize}`,
                };
              },
            },
          };
        },
      }),
      Color,
      FontFamily,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setHasChanges(true);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none min-h-[500px] p-6',
      },
      handleKeyDown: (view, event) => {
        // Check for slash command
        if (event.key === '/') {
          const coords = view.coordsAtPos(view.state.selection.$head.pos);
          
          setSlashMenuPosition({
            top: coords.top + 25,
            left: coords.left,
          });
          setShowSlashMenu(true);
        } else if (event.key === 'Escape') {
          setShowSlashMenu(false);
        }
      },
    },
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.color-picker-container')) {
        setShowColorPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchNote = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/notes/${noteId}`);
        if (response.ok) {
          const data = await response.json();
          setNote(data.note);
          
          // Parse the TipTap content
          try {
            const parsedContent = JSON.parse(data.note.content);
            editor?.commands.setContent(parsedContent);
          } catch (e) {
            console.error('Error parsing note content:', e);
            // If content is empty or invalid, start with empty content
            editor?.commands.setContent({});
          }
        }
      } catch (error) {
        console.error('Failed to fetch note:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNote();
  }, [user, noteId, editor]);

  const handleSave = async () => {
    if (!editor) return;
    
    setIsSaving(true);
    try {
      const content = JSON.stringify(editor.getJSON());

      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        const data = await response.json();
        setNote(data.note);
        setHasChanges(false);
        toast.success('Note saved!');
      } else {
        const error = await response.json();
        console.error('Failed to save:', error);
        toast.error('Failed to save note');
      }
    } catch (error) {
      console.error('Failed to save note:', error);
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const slashCommands = [
    { icon: Heading1, label: 'Heading 1', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleHeading({ level: 1 }).run() },
    { icon: Heading2, label: 'Heading 2', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleHeading({ level: 2 }).run() },
    { icon: Heading3, label: 'Heading 3', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleHeading({ level: 3 }).run() },
    { icon: List, label: 'Bullet List', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleBulletList().run() },
    { icon: ListOrdered, label: 'Numbered List', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleOrderedList().run() },
    { icon: Quote, label: 'Blockquote', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleBlockquote().run() },
    { icon: Code, label: 'Code Block', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleCodeBlock().run() },
    { icon: Calculator, label: 'Math Equation', command: () => {
      setShowMathDialog(true);
    }},
    { icon: Code, label: 'Divider', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).setHorizontalRule().run() },
    { icon: LinkIcon, label: 'Link', command: () => {
      const url = window.prompt('Enter URL:');
      if (url) {
        editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).setLink({ href: url }).run();
      }
    }},
  ];

  const executeSlashCommand = (command: () => void) => {
    command();
    setShowSlashMenu(false);
  };

  const increaseFontSize = () => {
    const newSize = Math.min(currentFontSize + 2, 72);
    setCurrentFontSize(newSize);
    editor?.chain().focus().setMark('textStyle', { fontSize: `${newSize}px` }).run();
  };

  const decreaseFontSize = () => {
    const newSize = Math.max(currentFontSize - 2, 8);
    setCurrentFontSize(newSize);
    editor?.chain().focus().setMark('textStyle', { fontSize: `${newSize}px` }).run();
  };

  const toggleBold = () => {
    editor?.chain().focus().toggleBold().run();
  };

  const toggleItalic = () => {
    editor?.chain().focus().toggleItalic().run();
  };

  const toggleUnderline = () => {
    editor?.chain().focus().toggleUnderline().run();
  };

  const toggleHighlight = () => {
    editor?.chain().focus().toggleHighlight().run();
  };

  const setColor = (color: string) => {
    setTextColor(color);
    editor?.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const handleColorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setTextColor(color);
    editor?.chain().focus().setColor(color).run();
  };


  const handleInsertMath = () => {
    const equation = mathEquation;
    
    if (equation.trim()) {
      // Insert the equation as a block
      editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).insertContent({
        type: 'paragraph',
        content: [{
          type: 'text',
          text: equation
        }]
      }).run();
      
      setShowMathDialog(false);
      setMathEquation('');
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

  if (!editor) {
    return null;
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

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-40">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Basic Formatting */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleBold}
              className={editor.isActive('bold') ? 'bg-gray-100' : ''}
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleItalic}
              className={editor.isActive('italic') ? 'bg-gray-100' : ''}
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleUnderline}
              className={editor.isActive('underline') ? 'bg-gray-100' : ''}
              title="Underline (Ctrl+U)"
            >
              <Underline className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHighlight}
              className={editor.isActive('highlight') ? 'bg-gray-100' : ''}
              title="Highlight"
            >
              <Highlighter className="w-4 h-4" />
            </Button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            {/* Font Size Controls */}
            <div className="flex items-center gap-1 border border-gray-300 rounded px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={decreaseFontSize}
                title="Decrease Font Size"
                className="h-7 w-7 p-0"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="text-sm font-medium min-w-[50px] text-center">{currentFontSize}px</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={increaseFontSize}
                title="Increase Font Size"
                className="h-7 w-7 p-0"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            
            {/* Text Color */}
            <div className="relative color-picker-container">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Text Color"
                className="flex items-center gap-1"
              >
                <Palette className="w-4 h-4" />
                <div 
                  className="w-3 h-3 rounded border border-gray-300" 
                  style={{ backgroundColor: textColor }}
                />
              </Button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 min-w-[250px]">
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Color Picker</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={handleColorInput}
                        className="w-full h-8 cursor-pointer rounded"
                      />
                      <input
                        type="text"
                        value={textColor}
                        onChange={handleColorInput}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <p className="text-xs text-gray-600 mb-2">Quick Colors</p>
                    <div className="grid grid-cols-6 gap-2">
                      {['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#64748B', '#E11D48'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setColor(color)}
                          className="w-8 h-8 rounded border-2 border-gray-300 hover:scale-110 transition-transform hover:border-gray-600"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="container mx-auto px-6 py-8 relative" ref={editorRef}>
        <div className="bg-white rounded-lg shadow-lg min-h-[600px]">
          <EditorContent editor={editor} />
        </div>

        {/* Slash Menu */}
        {showSlashMenu && (
          <div 
            className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1"
            style={{ 
              top: `${slashMenuPosition.top}px`, 
              left: `${slashMenuPosition.left}px`,
              zIndex: 50,
              minWidth: '280px',
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          >
            <div className="p-1">
              {slashCommands.map((cmd, index) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={index}
                    onClick={() => executeSlashCommand(cmd.command)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-900">{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Math Equation Dialog */}
      {showMathDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowMathDialog(false); setMathEquation(''); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 rounded-t-xl">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Math Equation Editor</h2>
                <p className="text-sm text-gray-600 mt-1">Type your equation naturally - no syntax needed!</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowMathDialog(false);
                  setMathEquation('');
                }}
                className="hover:bg-white/80"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-6">
              {/* Editor Section */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  ✨ Your Equation:
                </label>
                <Input
                  type="text"
                  value={mathEquation}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMathEquation(e.target.value)}
                  placeholder="Type your equation... (e.g., x^2 + 5x + 6)"
                  className="text-lg font-mono"
                  autoFocus
                />
                {mathEquation && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-blue-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">Equation:</p>
                    <div className="text-lg font-mono text-gray-800">
                      {mathEquation}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  💡 Type LaTeX syntax (e.g., x^2 for squared, fraction for division, sqrt for square root)
                </p>
              </div>

              {/* Quick Examples */}
              <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">🚀 Quick Examples:</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Quadratic', equation: 'x^2 + 5x + 6 = 0' },
                    { label: 'Integral', equation: '\\int x^2 dx' },
                    { label: 'Fraction', equation: '\\frac{a}{b} + c' },
                    { label: 'Sum', equation: '\\sum_{i=1}^{n} i' },
                  ].map((ex, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setMathEquation(ex.equation);
                      }}
                      className="text-left px-3 py-2 bg-white/80 hover:bg-white rounded border border-purple-300 transition-all hover:shadow-sm"
                    >
                      <div className="text-xs font-medium text-purple-700">{ex.label}</div>
                      <div className="text-xs text-gray-600 truncate">{ex.equation}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Symbol Buttons */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">🔣 Quick Insert:</h3>
                <div className="grid grid-cols-8 gap-2">
                  {[
                    { symbol: '+', name: 'Plus' },
                    { symbol: '-', name: 'Minus' },
                    { symbol: '×', name: 'Multiply' },
                    { symbol: '÷', name: 'Divide' },
                    { symbol: '²', name: 'Square' },
                    { symbol: '√', name: 'Sqrt' },
                    { symbol: '∑', name: 'Sum' },
                    { symbol: '∫', name: 'Integral' },
                    { symbol: 'α', name: 'Alpha' },
                    { symbol: 'β', name: 'Beta' },
                    { symbol: 'π', name: 'Pi' },
                    { symbol: '∞', name: 'Infinity' },
                    { symbol: '≤', name: 'Less eq' },
                    { symbol: '≥', name: 'Great eq' },
                    { symbol: '≈', name: 'Approx' },
                    { symbol: '≠', name: 'Not eq' },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setMathEquation(mathEquation + item.symbol);
                      }}
                      className="p-2 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded text-center transition-all hover:shadow-sm"
                      title={item.name}
                    >
                      <span className="text-lg">{item.symbol}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMathDialog(false);
                  setMathEquation('');
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleInsertMath}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Insert Equation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}