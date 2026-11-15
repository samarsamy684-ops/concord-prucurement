import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand"><span className="brand-mark">C</span><span>CONCORD<span className="brand-sub">PROCUREMENT</span></span></Link><p className="eyebrow">PROCUREMENT WORKSPACE</p><h1>Welcome back</h1><p className="auth-copy">Sign in to continue to your procurement operations.</p><AuthForm mode="sign-in" /><p className="auth-switch">New to Concord? <Link href="/sign-up">Create an account</Link></p><p className="secure-note">Protected workspace · Secure sign-in</p></section><div className="auth-side"><div className="auth-side-content"><p className="eyebrow">BUILT FOR ACCOUNTABILITY</p><h2>From request<br />to receipt.</h2><p>One connected workflow for every procurement decision, document, and approval.</p><div className="side-stat"><strong>3-way match</strong><span>Purchase order · Receipt · Invoice</span></div></div></div></main>
}
