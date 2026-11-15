import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect('/')
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand"><span className="brand-mark">C</span><span>CONCORD<span className="brand-sub">PROCUREMENT</span></span></Link><p className="eyebrow">PROCUREMENT WORKSPACE</p><h1>Create your account</h1><p className="auth-copy">Set up your secure workspace to manage the full purchasing cycle.</p><AuthForm mode="sign-up" /><p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p><p className="secure-note">Protected workspace · Secure sign-in</p></section><div className="auth-side"><div className="auth-side-content"><p className="eyebrow">ONE CONNECTED WORKFLOW</p><h2>Clear controls.<br />Confident buying.</h2><p>Coordinate requests, qualified vendors, purchase orders and receiving in one place.</p><div className="side-stat"><strong>Built around your BRD</strong><span>Concord procurement requirements</span></div></div></div></main>
}
