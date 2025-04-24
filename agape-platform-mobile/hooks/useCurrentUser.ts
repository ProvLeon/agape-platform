import { fetchCurrentUser } from '@/services/authService';
import { User } from '@/types';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useAuth } from './useAuth'; // To check if authenticated

export const CURRENT_USER_QUERY_KEY = ['currentUser'];

export const useCurrentUser = (): UseQueryResult<User | null, Error> => {
  const { authState } = useAuth();

  return useQuery<User | null, Error>({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: fetchCurrentUser,
    enabled: authState.isAuthenticated, // Only fetch if logged in
    staleTime: 5 * 60 * 1000, // 5 minutes - User data doesn't change THAT often
    refetchOnWindowFocus: true, // Automatically refetch on focus if stale (React Query handles this well)
    retry: 1, // Retry once on failure
    // Add placeholderData or initialData if needed from login response
  });
};
