'use client'

import { useState } from 'react'
import { LogIn, LogOut, Mail, Loader2, UserCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

/**
 * Auth button for the header. Renders nothing when Supabase is not
 * configured (the app works fully anonymously). When Supabase IS
 * configured, shows a sign-in button (magic link) or the user's email
 * with a sign-out option.
 */
export function AuthButton() {
  const { user, loading, configured, signInWithMagicLink, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  // Hidden when Supabase isn't configured — the app works anonymously.
  if (!configured) return null

  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled className="text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    )
  }

  if (user) {
    const emailAddr = user.email ?? 'Signed in'
    return (
      <div className="flex items-center gap-1">
        <span className="hidden items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 sm:flex" title={emailAddr}>
          <UserCircle className="h-3 w-3 text-emerald-400" />
          <span className="max-w-24 truncate">{emailAddr}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut()}
          className="text-zinc-400 hover:bg-zinc-900 hover:text-red-400"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const handleSend = async () => {
    if (!email.trim()) return
    setSending(true)
    try {
      await signInWithMagicLink(email.trim())
      toast({
        title: 'Magic link sent',
        description: `Check ${email.trim()} for a sign-in link.`,
      })
      setOpen(false)
      setEmail('')
    } catch (err) {
      toast({
        title: 'Sign-in failed',
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="text-zinc-300 hover:bg-zinc-900 hover:text-white"
        aria-label="Sign in"
        title="Sign in to sync across devices"
      >
        <LogIn className="h-5 w-5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-amber-400" />
              Sign in
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Enter your email and we will send a secure magic link. No password needed. Sign in to sync your scan history across devices and submit verified community reports.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="auth-email" className="text-zinc-300">Email</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-zinc-900 border-zinc-800 text-zinc-100"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !email.trim()}
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {sending ? 'Sending…' : 'Send magic link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
