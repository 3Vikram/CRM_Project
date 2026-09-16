import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { Extension } from '@tiptap/core'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'codeBlock'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {}
              return { style: `font-size: ${attributes.fontSize}` }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().focus().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().focus().setMark('textStyle', { fontSize: null }).run(),
    }
  },
})

interface TiptapEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  companyLogoUrl?: string
}

export function TiptapEditor({ value, onChange, placeholder, companyLogoUrl }: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-[#2563EB] underline' },
      }),
      Image.configure({
        inline: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value || '<p></p>',
    editorProps: {
      attributes: {
        class: 'min-h-[240px] px-4 py-3 text-sm text-gray-700 outline-none',
          style: 'font-family: "Times New Roman", Times, serif; line-height: 1.5;',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
    }
  }, [editor, value])

  const addImage = (file: File) => {
    if (!editor) return
    const reader = new FileReader()
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string, alt: file.name }).run()
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      addImage(file)
    }
    event.target.value = ''
  }

  const setLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href || ''
    const url = window.prompt('Enter URL', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const insertCompanyLogo = () => {
    if (!editor || !companyLogoUrl) return
    editor.chain().focus().setImage({ src: companyLogoUrl, alt: '' }).run()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#EFECE5] bg-[#FAF8F2]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EFECE5] bg-white p-2">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={`rounded p-2 ${editor?.isActive('bold') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Bold className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={`rounded p-2 ${editor?.isActive('italic') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Italic className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`rounded p-2 ${editor?.isActive('underline') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><UnderlineIcon className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleStrike().run()} className={`rounded p-2 ${editor?.isActive('strike') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Strikethrough className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={`rounded p-2 ${editor?.isActive('heading', { level: 1 }) ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Heading1 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={`rounded p-2 ${editor?.isActive('heading', { level: 2 }) ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Heading2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={`rounded p-2 ${editor?.isActive('heading', { level: 3 }) ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Heading3 className="h-4 w-4" /></button>

        <select
          className="rounded border border-[#EFECE5] bg-white px-2 py-1 text-sm"
          onChange={(event) => editor?.chain().focus().setFontSize(event.target.value).run()}
          defaultValue=""
        >
          <option value="">Font size</option>
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
          <option value="24px">24px</option>
        </select>

        <input type="color" onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()} className="h-8 w-8 cursor-pointer rounded border border-[#EFECE5] bg-white p-0" />
        <button type="button" onClick={() => editor?.chain().focus().toggleHighlight().run()} className={`rounded p-2 ${editor?.isActive('highlight') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Highlighter className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`rounded p-2 ${editor?.isActive('bulletList') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><List className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`rounded p-2 ${editor?.isActive('orderedList') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().setTextAlign('left').run()} className={`rounded p-2 ${editor?.isActive({ textAlign: 'left' }) ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><AlignLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().setTextAlign('center').run()} className={`rounded p-2 ${editor?.isActive({ textAlign: 'center' }) ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><AlignCenter className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().setTextAlign('right').run()} className={`rounded p-2 ${editor?.isActive({ textAlign: 'right' }) ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><AlignRight className="h-4 w-4" /></button>
        <button type="button" onClick={setLink} className={`rounded p-2 ${editor?.isActive('link') ? 'bg-[#111827] text-white' : 'text-gray-700 hover:bg-[#F2EFE8]'}`}><Link2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded p-2 text-gray-700 hover:bg-[#F2EFE8]"><ImageIcon className="h-4 w-4" /></button>
        <button type="button" onClick={insertCompanyLogo} disabled={!companyLogoUrl} title="Insert Company Logo" aria-label="Insert Company Logo" className="rounded p-2 text-gray-700 hover:bg-[#F2EFE8] disabled:cursor-not-allowed disabled:opacity-40"><ImagePlus className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().undo().run()} className="rounded p-2 text-gray-700 hover:bg-[#F2EFE8]"><Undo2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => editor?.chain().focus().redo().run()} className="rounded p-2 text-gray-700 hover:bg-[#F2EFE8]"><Redo2 className="h-4 w-4" /></button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  )
}
