const { createClient } = require("@supabase/supabase-js");
const environment = require("./environment");

const supabase = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
