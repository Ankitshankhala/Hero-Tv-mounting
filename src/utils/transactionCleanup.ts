import { supabase } from "@/integrations/supabase/client";

export async function deleteTransactions(transactionIds: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }

    const response = await supabase.functions.invoke('delete-transactions', {
      body: { transaction_ids: transactionIds },
    });

    if (response.error) {
      throw response.error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting transactions:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
