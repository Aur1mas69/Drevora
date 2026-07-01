import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'

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
  if (!isSupabaseConfigured) {
    throw new AuthServiceError(
      'Sign-in is unavailable because Supabase environment variables are not configured.',
    )
  }

  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail || !password) {
    throw new AuthServiceError('Email and password are required.')
  }

  const { data, error } = await requireSupabase().auth.signInWithPassword({
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
  if (!isSupabaseConfigured) {
    return
  }

  const { error } = await requireSupabase().auth.signOut()

  if (error) {
    throw new AuthServiceError(error.message)
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isSupabaseConfigured) {
    return null
  }

  const { data, error } = await requireSupabase().auth.getUser()

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
  if (!isSupabaseConfigured) {
    return null
  }

  const { data, error } = await requireSupabase().auth.getSession()

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

export async function updatePassword(newPassword: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new AuthServiceError(
      'Password update is unavailable because Supabase environment variables are not configured.',
    )
  }

  const { error } = await requireSupabase().auth.updateUser({
    password: newPassword,
  })

  if (error) {
    throw new AuthServiceError(error.message)
  }
}

export const authService = {
  signIn,
  signOut,
  getCurrentUser,
  getCurrentSession,
  updatePassword,
}
