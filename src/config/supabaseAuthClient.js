const { createClient } = require("@supabase/supabase-js");
const environment = require("./environment");

// Dedicated client using the anon/publishable key, used only for user-facing
// auth flows (signInWithPassword, refreshSession, signOut). Admin operations
// (creating users, DB access) must go through config/supabase.js instead,
// which holds the service role key.
const supabaseAuthClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabaseAuthClient;
