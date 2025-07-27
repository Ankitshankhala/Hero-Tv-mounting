import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const InvoiceTestButton = () => {
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const testInvoiceGeneration = async () => {
    setTesting(true);
    try {
      // Test invoice generation for the test booking
      const { data, error } = await supabase.functions.invoke('generate-invoice', {
        body: { 
          booking_id: '1364c530-90bc-4673-a249-bcd24a9edfd7',
          send_email: true 
        }
      });

      if (error) {
        console.error('Invoice generation error:', error);
        toast({
          title: 'Invoice Test Failed',
          description: `Error: ${error.message}`,
          variant: 'destructive'
        });
      } else {
        console.log('Invoice generation response:', data);
        toast({
          title: 'Invoice Generated',
          description: 'Check email logs for invoice email'
        });
      }

      // Check email logs for invoice emails
      setTimeout(async () => {
        const { data: logs } = await supabase
          .from('email_logs')
          .select('*')
          .eq('subject', 'Invoice for Your Service')
          .order('created_at', { ascending: false })
          .limit(3);
        
        console.log('Recent invoice email logs:', logs);
      }, 2000);

    } catch (error) {
      console.error('Invoice test error:', error);
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
    <Button onClick={testInvoiceGeneration} disabled={testing} variant="outline">
      {testing ? 'Testing Invoice...' : 'Test Invoice Generation'}
    </Button>
  );
};