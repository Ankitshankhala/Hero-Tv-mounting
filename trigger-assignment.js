// Quick script to trigger ZIP code assignment
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ggvplltpwsnvtcbpazbe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
);

const response = await supabase.functions.invoke('assign-regional-zipcodes', {
  body: {}
});

console.log('Assignment result:', response);