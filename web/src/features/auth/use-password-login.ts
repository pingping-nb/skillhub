import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/client'
import { ApiError } from '@/shared/lib/api-error'
import type { LocalLoginRequest, User } from '@/api/types'
import { clearSessionScopedQueries } from '@/features/notification/notification-session'

/**
 * Password-login mutation that can route to the local account endpoint or a
 * direct-auth provider (e.g. LDAP) based on the supplied provider code.
 *
 * When {@code provider} is omitted, the request goes to the fixed local account
 * endpoint ({@code /api/v1/auth/local/login}). When a provider is supplied, the
 * request goes to the direct-auth endpoint ({@code /api/v1/auth/direct/login}).
 */
export function usePasswordLogin(provider?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: LocalLoginRequest) => {
      if (provider) {
        return authApi.directLogin(provider, request)
      }
      return authApi.localLogin(request)
    },
    onSuccess: (user) => {
      clearSessionScopedQueries(queryClient)
      queryClient.setQueryData<User | null>(['auth', 'me'], user)
    },
    onError: (error) => {
      // Keep invalid credentials on the login page instead of falling back to the
      // global 401 redirect handler used for background API requests.
      if (error instanceof ApiError) {
        return
      }
    },
  })
}
