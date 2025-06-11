
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface UseAuthenticatedQueryOptions {
  requireAuth?: boolean;
  allowedRoles?: string[];
  redirectOnFail?: boolean;
}

export const useAuthenticatedQuery = (options: UseAuthenticatedQueryOptions = {}) => {
  const { 
    requireAuth = true, 
    allowedRoles = [], 
    redirectOnFail = false 
  } = options;
  
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    // Check if authentication is required
    if (requireAuth && !user) {
      setAuthError('Authentication required');
      setIsAuthorized(false);
      
      if (redirectOnFail) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to access this feature",
          variant: "destructive",
        });
      }
      return;
    }

    // Check role-based authorization
    if (allowedRoles.length > 0 && profile) {
      if (!allowedRoles.includes(profile.role)) {
        setAuthError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
        setIsAuthorized(false);
        
        if (redirectOnFail) {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access this feature",
            variant: "destructive",
          });
        }
        return;
      }
    }

    // All checks passed
    setAuthError(null);
    setIsAuthorized(true);
  }, [user, profile, authLoading, requireAuth, allowedRoles, redirectOnFail, toast]);

  return {
    isAuthorized,
    authError,
    isLoading: authLoading,
    user,
    profile
  };
};
