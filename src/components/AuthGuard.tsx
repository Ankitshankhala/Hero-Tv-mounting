
import React from 'react';
import { useAuthenticatedQuery } from '@/hooks/useAuthenticatedQuery';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Lock } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: string[];
  fallback?: React.ReactNode;
}

export const AuthGuard = ({ 
  children, 
  requireAuth = true, 
  allowedRoles = [],
  fallback 
}: AuthGuardProps) => {
  const { isAuthorized, authError, isLoading } = useAuthenticatedQuery({
    requireAuth,
    allowedRoles,
    redirectOnFail: false
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            {authError?.includes('Authentication') ? (
              <Lock className="h-12 w-12 text-gray-400 mx-auto" />
            ) : (
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto" />
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {authError?.includes('Authentication') ? 'Sign In Required' : 'Access Denied'}
              </h3>
              <p className="text-gray-600 mt-2">{authError}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};
