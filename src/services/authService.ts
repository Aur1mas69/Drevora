import { supabase } from '@/lib/supabase'

export type AuthUser = {
  id: string
  email: string
}

export type AuthSession = {
  accessToken: string
  user: AuthUser
}

export type SignInResult = {
  session: AuthSession
}

export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthServiceError'
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail || !password) {
    throw new AuthServiceError('Email and password are required.')
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    throw new AuthServiceError(error.message)
  }

  if (!data.session || !data.user.email) {
    throw new AuthServiceError('Unable to start a valid Supabase session.')
  }

  return {
    session: {
      accessToken: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    },
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new AuthServiceError(error.message)
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new AuthServiceError(error.message)
  }

  if (!data.user?.email) {
    return null
  }

  return {
    id: data.user.id,
    email: data.user.email,
  }
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new AuthServiceError(error.message)
  }

  if (!data.session?.user.email) {
    return null
  }

  return {
    accessToken: data.session.access_token,
    user: {
      id: data.session.user.id,
      email: data.session.user.email,
    },
  }
}

export const authService = {
  signIn,
  signOut,
  getCurrentUser,
  getCurrentSession,
}
