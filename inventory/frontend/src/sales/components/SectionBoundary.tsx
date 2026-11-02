import { Component, type ErrorInfo, type ReactNode } from 'react'

interface SectionBoundaryProps {
  children: ReactNode
  className?: string
}

interface SectionBoundaryState {
  hasError: boolean
}

export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  state: SectionBoundaryState = { hasError: false }

  static getDerivedStateFromError(): SectionBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Sales dashboard section failed to render:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <div className={this.props.className} role="alert"><div className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700">This dashboard section could not be displayed.</div></div>
    }

    return <div className={this.props.className}>{this.props.children}</div>
  }
}
