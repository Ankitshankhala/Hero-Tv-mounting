// Temporary script to add ZIP code 78758 to Connor's service area
console.log('Adding ZIP code 78758 to Connor service area...');

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ggvplltpwsnvtcbpazbe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
);

async function addZipcode() {
  // Call the service area upsert function
  const { data, error } = await supabase.functions.invoke('service-area-upsert', {
    body: {
      worker_id: '3e2e7780-6abd-40f5-a5a2-70286b7496de',
      area_name: 'North Austin MAP',
      mode: 'append',
      zip_codes: ['78758']
    }
  });
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}

addZipcode();