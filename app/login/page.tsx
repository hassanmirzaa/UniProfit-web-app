'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingUp, Loader2, Mail, Lock, LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const next = searchParams.get('next') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const supabase = createClient()

  // If already logged in, leave login and go to destination (replace so back button doesn’t return here)
  useEffect(() => {
    if (authLoading || !user) return
    router.replace(next)
  }, [user, authLoading, next, router])

  const clearMessage = () => setMessage(null)

  const handleGoogleSignIn = async () => {
    setLoading(true)
    clearMessage()
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
    }
  }

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setMessage({ type: 'error', text: 'Enter email and password.' })
      return
    }
    setLoading(true)
    clearMessage()
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
        return
      }
      setMessage({
        type: 'success',
        text: 'Check your email for the confirmation link to complete sign up.',
      })
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setMessage({ type: 'error', text: error.message })
        setLoading(false)
        return
      }
      window.location.href = next
    }
    setLoading(false)
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Enter your email.' })
      return
    }
    setLoading(true)
    clearMessage()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }
    setOtpSent(true)
    setMessage({ type: 'success', text: 'Check your email for the verification code.' })
    setLoading(false)
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !otpCode.trim()) {
      setMessage({ type: 'error', text: 'Enter email and the code from your email.' })
      return
    }
    setLoading(true)
    clearMessage()
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: 'email',
    })
    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }
    window.location.href = next
  }

  if (!authLoading && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Taking you back…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Link href="/" className="flex items-center gap-2 text-foreground mb-8">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold">Uniprofit</span>
      </Link>

      <Card className="w-full max-w-md p-6 border border-border">
        <h1 className="text-2xl font-bold text-foreground mb-6 text-center">Sign in</h1>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 mb-6"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Continue with Google
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Tabs defaultValue="password" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="password">Email & password</TabsTrigger>
            <TabsTrigger value="otp">Verification code</TabsTrigger>
          </TabsList>
          <TabsContent value="password">
            <form onSubmit={handleEmailPassword} className="space-y-4">
              <div>
                <Label htmlFor="email-pw">Email</Label>
                <Input
                  id="email-pw"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {isSignUp ? 'Sign up' : 'Sign in'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsSignUp(!isSignUp)}
                  disabled={loading}
                >
                  {isSignUp ? 'Sign in instead' : 'Sign up'}
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="otp">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <Label htmlFor="email-otp">Email</Label>
                  <Input
                    id="email-otp"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    autoComplete="email"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Send verification code
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <Label htmlFor="email-verify">Email</Label>
                  <Input
                    id="email-verify"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <Label htmlFor="otp">Verification code</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    className="mt-1 font-mono text-lg tracking-widest"
                    maxLength={8}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Verify & sign in
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setOtpSent(false); setOtpCode(''); clearMessage(); }}
                    disabled={loading}
                  >
                    Back
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>
        </Tabs>

        {message && (
          <p
            className={`mt-4 text-sm ${
              message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-destructive'
            }`}
          >
            {message.text}
          </p>
        )}
      </Card>
    </div>
  )
}
