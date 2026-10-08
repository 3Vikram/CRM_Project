'use client'

import { ReactNode, useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false)
      setIsMounted(false)
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setIsMounted(true)
    setIsClosing(false)

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  const handleClose = () => {
    if (!isOpen) return
    setIsClosing(true)
    window.setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 250)
  }

  if (!isMounted && !isOpen) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div
          className={`pointer-events-auto w-full max-w-md overflow-hidden rounded-xl border border-[#EFECE5] bg-white shadow-2xl transition-all duration-300 ease-out ${
            isClosing ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
          }`}
          style={{
            marginTop: '4.5rem',
            maxHeight: 'calc(100vh - 4.5rem - 30px)',
          }}
        >
          <div className="flex items-center justify-between border-b border-[#EFECE5] bg-white px-6 py-4">
            <h2 className="text-lg font-serif font-bold text-gray-900">{title}</h2>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 transition-colors hover:bg-[#F2EFE8]"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-6">{children}</div>

          {footer && (
            <div className="sticky bottom-0 border-t border-[#EFECE5] bg-white px-6 py-4">{footer}</div>
          )}
        </div>
      </div>
    </>
  )
}
