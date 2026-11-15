'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'

type Props = { mode: 'sign-in' | 'sign-up' }

export function AuthForm({ mode }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const form = new FormData(event.currentTarget)
    const result = isSignUp
      ? await authClient.signUp.email({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')) })
      : await authClient.signIn.email({ email: String(form.get('email')), password: String(form.get('password')) })
    setPending(false)
    if (result.error) {
      setError('We could not verify those details. Please try again.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {isSignUp && <label>Full name<input name="name" placeholder="Your name" autoComplete="name" required minLength={2} /></label>}
      <label>Email address<span className="input-icon"><Mail size={16} /><input name="email" type="email" placeholder="you@company.com" autoComplete="email" required /></span></label>
      <label>Password<span className="input-icon"><LockKeyhole size={16} /><input name="password" type={showPassword ? 'text' : 'password'} placeholder="At least 8 characters" autoComplete={isSignUp ? 'new-password' : 'current-password'} required minLength={8} /><button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="auth-submit" disabled={pending}>{pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
    </form>
  )
}
