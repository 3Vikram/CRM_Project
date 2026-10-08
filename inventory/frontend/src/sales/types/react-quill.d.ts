declare module 'react-quill' {
  import * as React from 'react'

  interface ReactQuillProps {
    value?: string
    onChange?: (value: string) => void
    theme?: string
    modules?: Record<string, unknown>
    formats?: string[]
    placeholder?: string
    className?: string
  }

  class ReactQuill extends React.Component<ReactQuillProps> {}

  export default ReactQuill
}
