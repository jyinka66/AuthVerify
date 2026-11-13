'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Client-side error boundary. Catches render errors, logs them to
 * /api/errors, and shows a recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Log to the error endpoint.
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}`,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // If error logging itself fails, swallow — don't crash the boundary.
    })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined })
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 p-6 text-center">
          <div className="rounded-full bg-red-500/10 p-4">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Something went wrong</h1>
            <p className="mt-1 max-w-xs text-sm text-zinc-400">
              The app hit an unexpected error. Your scan history is safe. Try reloading.
            </p>
            {this.state.error?.message && (
              <p className="mt-3 rounded-md bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-500">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button onClick={this.handleReload} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
            <RefreshCw className="mr-2 h-4 w-4" /> Reload app
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
