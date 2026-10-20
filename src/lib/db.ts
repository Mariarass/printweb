import { createClient } from "@supabase/supabase-js";
import { dbReady } from "./config";

export function database() {
  if (!dbReady()) throw new Error("New shop database is not configured.");
  return createClient(process.env.GP_SUPABASE_URL!, process.env.GP_SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
