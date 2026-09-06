import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ override: true });

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://fmwbucdpsexeohnfgmxy.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtd2J1Y2Rwc2V4ZW9obmZnbXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzMjQ5NTksImV4cCI6MjA1NjkwMDk1OX0.placeholder";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

