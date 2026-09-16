import { useRef, useState, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  error?: string
  disabled?: boolean
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter options based on search term (case-insensitive)
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // When dropdown opens, focus on input and clear search
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setSearchTerm('')
      setHighlightedIndex(0)
    }
  }, [isOpen])

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
      default:
        // Regular character input - keep typing in search field
        // This is handled by onChange
        break
    }
  }

  const handleSelect = (option: string) => {
    onChange(option)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setHighlightedIndex(0)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleClear = () => {
    onChange('')
    setSearchTerm('')
    setIsOpen(false)
  }

  // Get display value (show search term if open, otherwise show selected value)
  const displayValue = isOpen ? searchTerm : value

  // Find the display text for selected value
  const selectedOption = options.find(opt => opt === value)

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? placeholder : selectedOption || placeholder}
          disabled={disabled}
          className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#CEC9BD] transition ${
            error ? 'border-red-500' : 'border-[#EFECE5]'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />

        {/* Clear button */}
        {value && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Chevron icon */}
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none transition ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#EFECE5] rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto"
          onMouseDown={e => e.preventDefault()} // Prevent blur on option hover
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-gray-500 text-center">
              No options found
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`w-full text-left px-3 py-2.5 text-sm transition ${
                  index === highlightedIndex
                    ? 'bg-[#F2EFE8] text-[#111827]'
                    : 'text-gray-700 hover:bg-gray-50'
                } ${value === option ? 'bg-[#111827] text-white font-medium' : ''}`}
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}

      {/* Error message */}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
