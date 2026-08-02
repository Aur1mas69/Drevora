import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import {
  readNativeStoredAuthSession,
  recoverNativeSessionAfterRefreshFailure,
} from '@/lib/nativeAuthSessionRecover'

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

  try {
    const { data, error } = await requireSupabase().auth.getSession()

    if (data.session?.user.email) {
      return {
        accessToken: data.session.access_token,
        user: {
          id: data.session.user.id,
          email: data.session.user.email,
        },
      }
    }

    // Web/PWA + Native: network refresh failure must not wipe a still-stored
    // session (localStorage / SecureAuthStorage) on cold start offline.
    const recovered = await recoverNativeSessionAfterRefreshFailure(error)
    if (recovered) {
      return recovered
    }

    // Browsers/emulators often report "connected" while fetches fail and
    // getSession returns null without a classified auth error. Prefer a
    // still-stored session over treating the Worker as signed out.
    const stored = await readNativeStoredAuthSession()
    if (stored) {
      return stored
    }

    if (error) {
      throw new AuthServiceError(error.message)
    }

    return null
  } catch (caught) {
    if (caught instanceof AuthServiceError) {
      throw caught
    }

    const recovered = await recoverNativeSessionAfterRefreshFailure(caught)
    if (recovered) {
      return recovered
    }

    const stored = await readNativeStoredAuthSession()
    if (stored) {
      return stored
    }

    throw caught instanceof Error
      ? new AuthServiceError(caught.message)
      : new AuthServiceError('Unable to restore the current session.')
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

export async function requestPasswordReset(
  email: string,
  redirectTo: string,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new AuthServiceError(
      'Password reset is unavailable because Supabase environment variables are not configured.',
    )
  }

  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    throw new AuthServiceError('Email is required.')
  }

  const { error } = await requireSupabase().auth.resetPasswordForEmail(
    normalizedEmail,
    { redirectTo },
  )

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
  requestPasswordReset,
}
