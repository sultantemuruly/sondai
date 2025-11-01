'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { ArrowLeft, Save, Bold, Italic, Underline, Highlighter, Palette, Type, Calculator, Plus, Minus, X, Type as TypeIcon, Hash, List as ListIcon, ListOrdered as ListOrderedIcon, Quote as QuoteIcon, Code as CodeIcon, Minus as HorizontalRuleIcon, Link2, AlignLeft, AlignCenter, AlignRight, ChevronRight, Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExtension from '@tiptap/extension-underline'
import LinkExtension from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import { Mathematics } from '@tiptap/extension-mathematics'
import { Heading1, Heading2, Heading3, List, ListOrdered } from 'lucide-react'
import { toast } from 'sonner'
import 'katex/dist/katex.min.css'
import { MathEditorDialog } from '@/components/math-editor-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
  const [folder, setFolder] = useState<{ id: number; name: string; parent_id: number | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMathDialog, setShowMathDialog] = useState(false);
  const [mathLatex, setMathLatex] = useState('');
  const [currentFontSize, setCurrentFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#000000');
  const [showFontSizeMenu, setShowFontSizeMenu] = useState(false);
  const [customFontSize, setCustomFontSize] = useState('16');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Mathematics.configure({
        inlineOptions: {
          onClick: (node, pos) => {
            // Open dialog to edit math node
            const currentLatex = node.attrs.latex || '';
            setMathLatex(currentLatex);
            setShowMathDialog(true);
          },
        },
        blockOptions: {
          onClick: (node, pos) => {
            // Open dialog to edit block math
            const currentLatex = node.attrs.latex || '';
            setMathLatex(currentLatex);
            setShowMathDialog(true);
          },
        },
        katexOptions: {
          throwOnError: false,
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
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
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
        } else if ((event.key === ' ' || event.key === 'Enter') && showSlashMenu) {
          // Close slash menu on space or Enter without executing
          event.preventDefault();
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
      if (!target.closest('.font-size-container')) {
        setShowFontSizeMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (editor) {
      const updateCurrentFontSize = () => {
        const { from, to } = editor.state.selection;
        let foundSize = 16;
        let hasSize = false;
        
        // Check marks at the cursor or selection
        const $pos = editor.state.doc.resolve(from);
        const marks = $pos.marks();
        
        marks.forEach(mark => {
          if (mark.type.name === 'textStyle' && mark.attrs.fontSize) {
            const sizeStr = mark.attrs.fontSize.replace('px', '');
            const size = parseInt(sizeStr);
            if (!isNaN(size)) {
              foundSize = size;
              hasSize = true;
            }
          }
        });
        
        if (foundSize !== currentFontSize && hasSize) {
          setCurrentFontSize(foundSize);
          setCustomFontSize(foundSize.toString());
        } else if (!hasSize && currentFontSize !== 16) {
          // No font size set, use default
          setCurrentFontSize(16);
          setCustomFontSize('16');
        }
      };
      
      editor.on('selectionUpdate', updateCurrentFontSize);
      editor.on('update', updateCurrentFontSize);
      
      return () => {
        editor.off('selectionUpdate', updateCurrentFontSize);
        editor.off('update', updateCurrentFontSize);
      };
    }
  }, [editor, currentFontSize]);

  useEffect(() => {
    const fetchNote = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/notes/${noteId}`);
        if (response.ok) {
          const data = await response.json();
          setNote(data.note);
          
          // Fetch folder info if available
          if (data.note.folder_id) {
            try {
              const folderResponse = await fetch(`/api/folders/${data.note.folder_id}`);
              if (folderResponse.ok) {
                const folderData = await folderResponse.json();
                setFolder(folderData.folder);
              }
            } catch (error) {
              console.error('Failed to fetch folder:', error);
            }
          }
          
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
    { icon: QuoteIcon, label: 'Blockquote', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleBlockquote().run() },
    { icon: CodeIcon, label: 'Code Block', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).toggleCodeBlock().run() },
    { icon: Calculator, label: 'Math Equation', command: () => {
      setShowMathDialog(true);
    }},
    { icon: HorizontalRuleIcon, label: 'Divider', command: () => editor?.chain().focus().deleteRange({ from: editor.state.selection.$head.pos - 1, to: editor.state.selection.$head.pos }).setHorizontalRule().run() },
    { icon: Link2, label: 'Link', command: () => {
      setShowLinkDialog(true);
    }},
    { icon: TypeIcon, label: 'Font Size', command: () => {
      setShowFontSizeMenu(true);
    }},
    { icon: Palette, label: 'Text Color', command: () => {
      setShowColorPicker(true);
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

  const setFontSize = (size: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    console.log('Setting font size to:', size);
    setCurrentFontSize(size);
    setCustomFontSize(size.toString());
    
    // Apply the font size to selection
    if (editor && editor.isEditable) {
      editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
      console.log('Font size applied');
    }
    
    setShowFontSizeMenu(false);
  };

  const handleCustomFontSize = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomFontSize(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 8 && numValue <= 400) {
      setFontSize(numValue);
    }
  };

  const handleCustomFontSizeBlur = () => {
    const numValue = parseInt(customFontSize);
    if (!isNaN(numValue) && numValue >= 8 && numValue <= 400) {
      setFontSize(numValue);
    } else {
      setCustomFontSize(currentFontSize.toString());
    }
    setShowFontSizeMenu(false);
  };

  const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 56, 64, 72];

  const handleInsertLink = () => {
    if (linkUrl.trim()) {
      // Add protocol if missing
      let url = linkUrl.trim();
      if (!url.match(/^https?:\/\//)) {
        url = 'https://' + url;
      }
      
      editor?.chain().focus().deleteRange({ 
        from: editor.state.selection.$head.pos - 1, 
        to: editor.state.selection.$head.pos 
      }).setLink({ href: url }).run();
      
      setLinkUrl('');
      setShowLinkDialog(false);
      toast.success('Link inserted!');
    }
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

  const setAlignLeft = () => {
    editor?.chain().focus().setTextAlign('left').run();
  };

  const setAlignCenter = () => {
    editor?.chain().focus().setTextAlign('center').run();
  };

  const setAlignRight = () => {
    editor?.chain().focus().setTextAlign('right').run();
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


  const handleInsertMath = (latex: string) => {
    if (!editor) return;
    
    if (latex.trim()) {
      // Insert inline math using the official TipTap Mathematics extension
      editor.commands.deleteRange({ 
        from: editor.state.selection.from - 1, 
        to: editor.state.selection.to 
      });
      
      editor.commands.insertInlineMath({ latex });
      
      setMathLatex('');
      toast.success('Math equation inserted!');
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-900">Loading...</p>
          <p className="text-sm text-muted-foreground mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Note not found</h1>
          <Link href="/dashboard">
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!editor) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href={note.folder_id ? `/dashboard/${note.folder_id}` : `/dashboard`}>
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
            
            {/* Structure Tools */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'bg-gray-100' : ''}
              title="Heading 1"
            >
              <Hash className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-100' : ''}
              title="Heading 2"
            >
              H2
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive('heading', { level: 3 }) ? 'bg-gray-100' : ''}
              title="Heading 3"
            >
              H3
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'bg-gray-100' : ''}
              title="Bullet List"
            >
              <ListIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? 'bg-gray-100' : ''}
              title="Numbered List"
            >
              <ListOrderedIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={editor.isActive('blockquote') ? 'bg-gray-100' : ''}
              title="Blockquote"
            >
              <QuoteIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              className={editor.isActive('codeBlock') ? 'bg-gray-100' : ''}
              title="Code Block"
            >
              <CodeIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMathDialog(true)}
              title="Math Equation"
            >
              <Calculator className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              title="Divider"
            >
              <HorizontalRuleIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLinkDialog(true)}
              title="Insert Link"
            >
              <Link2 className="w-4 h-4" />
            </Button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            {/* Text Alignment */}
            <Button
              variant="ghost"
              size="sm"
              onClick={setAlignLeft}
              className={editor.isActive({ textAlign: 'left' }) ? 'bg-gray-100' : ''}
              title="Align Left"
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={setAlignCenter}
              className={editor.isActive({ textAlign: 'center' }) ? 'bg-gray-100' : ''}
              title="Align Center"
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={setAlignRight}
              className={editor.isActive({ textAlign: 'right' }) ? 'bg-gray-100' : ''}
              title="Align Right"
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            
            <div className="w-px h-6 bg-gray-300 mx-2" />
            
            {/* Font Size Controls */}
            <div className="flex items-center gap-1 font-size-container">
              <Button
                variant="ghost"
                size="sm"
                onClick={decreaseFontSize}
                title="Decrease Font Size"
                className="h-8 w-8 p-0"
              >
                <Minus className="w-3 h-3" />
              </Button>
              
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFontSizeMenu(!showFontSizeMenu)}
                  title="Font Size"
                  className="h-8 px-2 flex items-center gap-2 min-w-[70px] justify-center border border-gray-300"
                >
                  <Type className="w-4 h-4" />
                  <span className="text-sm font-medium">{currentFontSize}</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
                
                {showFontSizeMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-48 max-h-[400px] overflow-y-auto">
                  {/* Custom Input */}
                  <div className="p-3 border-b border-gray-200">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Custom Size (8-400)</label>
                    <input
                      type="number"
                      min="8"
                      max="400"
                      value={customFontSize}
                      onChange={handleCustomFontSize}
                      onBlur={handleCustomFontSizeBlur}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      placeholder="e.g. 16"
                      autoFocus
                    />
                  </div>
                  
                  {/* Predefined Sizes */}
                  <div className="p-2">
                    <div className="grid grid-cols-2 gap-1">
                      {fontSizes.map((size) => (
                        <button
                          key={size}
                          onClick={(e) => setFontSize(size, e)}
                          className={`px-2 py-1 text-sm text-left hover:bg-gray-100 rounded ${
                            currentFontSize === size ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                          }`}
                        >
                          {size}px
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Common Actions */}
                  <div className="p-2 border-t border-gray-200">
                    <button
                      onClick={(e) => setFontSize(currentFontSize - 2, e)}
                      disabled={currentFontSize <= 8}
                      className="w-full px-2 py-1 text-sm text-left hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Minus className="w-3 h-3" />
                      Smaller
                    </button>
                    <button
                      onClick={(e) => setFontSize(currentFontSize + 2, e)}
                      disabled={currentFontSize >= 72}
                      className="w-full px-2 py-1 text-sm text-left hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mt-1"
                    >
                      <Plus className="w-3 h-3" />
                      Larger
                    </button>
                  </div>
                </div>
              )}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={increaseFontSize}
                title="Increase Font Size"
                className="h-8 w-8 p-0"
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
                    <div className="grid grid-cols-8 gap-2">
                      {/* Expanded color palette with richer colors */}
                      {[
                        // Grayscale
                        '#000000', '#1F2937', '#4B5563', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6',
                        // Reds
                        '#DC2626', '#EF4444', '#F87171', '#FCA5A5',
                        // Oranges
                        '#EA580C', '#F97316', '#FB923C', '#FDBA74',
                        // Yellows
                        '#CA8A04', '#FBBF24', '#FCD34D', '#FDE68A',
                        // Greens
                        '#059669', '#10B981', '#34D399', '#6EE7B7',
                        // Blues
                        '#0369A1', '#3B82F6', '#60A5FA', '#93C5FD',
                        // Purples
                        '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD',
                        // Pinks
                        '#DB2777', '#EC4899', '#F472B6', '#F9A8D4',
                        // Teals
                        '#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4',
                        // Indigos
                        '#4F46E5', '#6366F1', '#818CF8', '#A5B4FC',
                        '#7C2D12', '#991B1B', '#166534', '#065F46', '#1E40AF', '#312E81', '#581C87', '#831843'
                      ].map((color) => (
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

      {/* Visual Math Editor Dialog */}
      <MathEditorDialog
        isOpen={showMathDialog}
        onClose={() => setShowMathDialog(false)}
        onInsert={handleInsertMath}
        initialLatex={mathLatex}
      />

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
            <DialogDescription>
              Enter the URL you want to link to
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="https://example.com or example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInsertLink();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInsertLink}
              disabled={!linkUrl.trim()}
            >
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}