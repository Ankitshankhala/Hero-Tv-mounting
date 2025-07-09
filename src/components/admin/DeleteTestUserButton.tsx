import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const DeleteTestUserButton = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const deleteTestUser = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('delete-test-user', {
        body: {}
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Test user worker@test.com deleted successfully",
      });

      // Refresh the page to clear any cached auth state
      window.location.reload();

    } catch (error: any) {
      console.error('Error deleting test user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete test user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={deleteTestUser}
      disabled={loading}
      variant="destructive"
      size="sm"
      className="flex items-center gap-2"
    >
      <Trash2 className="h-4 w-4" />
      {loading ? 'Deleting...' : 'Delete Test User (worker@test.com)'}
    </Button>
  );
};