'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Meh, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface Props {
  scanId: string
  deviceFingerprint: string
}

type Feedback = 'correct' | 'incorrect' | 'partially_correct'

export function FeedbackWidget({ scanId, deviceFingerprint }: Props) {
  const [submitted, setSubmitted] = useState<Feedback | null>(null)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (feedback: Feedback) => {
    setSubmitted(feedback)
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, deviceFingerprint, feedback, notes: notes.trim() || undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      toast({ title: 'Feedback recorded', description: 'Thank you — this helps improve detection for everyone.' })
    } catch {
      toast({ title: 'Feedback failed', variant: 'destructive' })
      setSubmitted(null)
    } finally {
      setSending(false)
    }
  }

  if (submitted && !showNotes) {
    return (
      <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Feedback recorded
        </div>
        <div className="mt-2 flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowNotes(true)} className="text-zinc-400 hover:text-zinc-200">
            Add details
          </Button>
        </div>
        {showNotes && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was wrong? (e.g. 'It said authentic but the hologram was clearly missing')"
              rows={2}
              className="bg-zinc-950 border-zinc-800 text-zinc-100 resize-none text-xs"
            />
            <Button size="sm" onClick={() => handleSubmit(submitted)} disabled={sending} className="bg-amber-500 text-zinc-950 hover:bg-amber-400">
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Submit details'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-zinc-900 p-4 ring-1 ring-inset ring-zinc-800">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Was this verdict correct?
      </h3>
      <div className="flex gap-2">
        <FeedbackButton icon={ThumbsUp} label="Correct" active={submitted === 'correct'} onClick={() => handleSubmit('correct')} disabled={sending} />
        <FeedbackButton icon={Meh} label="Partially" active={submitted === 'partially_correct'} onClick={() => handleSubmit('partially_correct')} disabled={sending} />
        <FeedbackButton icon={ThumbsDown} label="Wrong" active={submitted === 'incorrect'} onClick={() => handleSubmit('incorrect')} disabled={sending} />
      </div>
    </div>
  )
}

function FeedbackButton({ icon: Icon, label, active, onClick, disabled }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 rounded-md py-2 text-xs font-medium transition-colors',
        active ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30' : 'bg-zinc-950/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200',
        disabled && 'opacity-50'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}
