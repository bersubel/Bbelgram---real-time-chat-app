'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const [isSignUp, setIsSignUp] = useState(false)
  const [notification, setNotification] = useState<{ type: 'error' | 'success', message: string } | null>(null)
  
  // NEW: State to trigger the full-screen splash animation
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setNotification(null)
  }, [isSignUp])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setNotification({ type: 'error', message: 'Please enter both email and password.' })
      return
    }

    setLoading(true)
    setNotification(null)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setNotification({ type: 'error', message: error.message })
        setLoading(false)
      } else if (!data.session) {
        setNotification({ type: 'error', message: "Account already exists. Try switching to Sign In!" })
        setLoading(false)
      } else {
        // Trigger Animation, wait 1.5s, then route
        setIsTransitioning(true)
        setTimeout(() => router.push('/chat'), 1500)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setNotification({ type: 'error', message: 'Invalid email or password.' })
        setLoading(false)
      } else {
        // Trigger Animation, wait 1.5s, then route
        setIsTransitioning(true)
        setTimeout(() => router.push('/chat'), 1500)
      }
    }
  }

  return (
    <>
      {/* THE SPLASH SCREEN TRANSITION OVERLAY */}
      {isTransitioning && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0e1621] transition-opacity duration-500">
          <div className="relative h-28 w-28 animate-bounce">
            <div className="absolute inset-0 rounded-full bg-[#5293d9] blur-xl opacity-40 animate-pulse"></div>
            <img 
              src="/Bbelgram-logo.png" 
              alt="Bbelgram Logo" 
              className="relative h-full w-full object-cover rounded-full shadow-2xl"
              onError={(e) => { (e.target as HTMLImageElement).src = '/Bbelgram-logo.jpg' }}
            />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-widest text-white animate-pulse">
            Bbelgram
          </h1>
        </div>
      )}

      {/* NORMAL LOGIN PAGE (Hidden when transitioning) */}
      <div className={`flex min-h-screen items-center justify-center bg-slate-50 p-4 font-sans text-slate-800 ${isTransitioning ? 'hidden' : ''}`}>
        <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10">
          
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-sky-500/10">
              <img 
                src="/Bbelgram-logo.png" 
                alt="Bbelgram Logo" 
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/Bbelgram-logo.jpg' }}
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Bbelgram
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {isSignUp ? 'Create a new account' : 'Sign in to your account'}
            </p>
          </div>

          {notification && (
            <div className={`mb-6 rounded-xl p-4 text-sm font-medium ${notification.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
              {notification.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@example.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm outline-none transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm outline-none transition-all focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-500/10" />
            </div>
            <button type="submit" disabled={loading} className="mt-2 w-full rounded-xl bg-sky-500 p-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:opacity-60">
              {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500">
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="font-semibold text-sky-500 hover:text-sky-600 hover:underline outline-none">
              {isSignUp ? 'Log in instead' : 'Sign up'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}