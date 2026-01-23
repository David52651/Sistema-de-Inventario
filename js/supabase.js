const SUPABASE_URL = 'https://dtwbcuiokwklilryvziy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0d2JjdWlva3drbGlscnl2eml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTU2OTcsImV4cCI6MjA4NDU5MTY5N30.WSdJcO8BtLd9tcMqJVPVIgwtNncuZrWtHV4XZmRwgzw';


window.db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
