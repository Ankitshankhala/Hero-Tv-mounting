import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const EmailTestButton = () => {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testEmail = async () => {
    setTesting(true);
    try {
      // Test the email function directly
      const { data, error } = await supabase.functions.invoke('send-worker-assignment-email', {
        body: { bookingId: '1364c530-90bc-4673-a249-bcd24a9edfd7' }
      });

      if (error) {
        console.error('Email function error:', error);
        toast({
          title: 'Email Test Failed',
          description: `Error: ${error.message}`,
          variant: 'destructive'
        });
      } else {
        console.log('Email function response:', data);
        toast({
          title: 'Email Test Started',
          description: 'Check email logs for results'
        });
      }

      // Check email logs after a brief delay
      setTimeout(async () => {
        const { data: logs } = await supabase
          .from('email_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        
        console.log('Recent email logs:', logs);
      }, 2000);

    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: 'Test Failed',
        description: 'Check console for details',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button onClick={testEmail} disabled={testing}>
      {testing ? 'Testing Email...' : 'Test Email Function'}
    </Button>
  );
};