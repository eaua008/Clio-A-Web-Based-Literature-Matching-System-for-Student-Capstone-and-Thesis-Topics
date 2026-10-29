/* Clio — connection settings. Fill these in from Supabase: Project Settings > API.
   - supabaseUrl:     your Project URL, like https://abcdefghijkl.supabase.co
   - supabaseAnonKey: the public "anon" / "publishable" key. It is safe in the browser ONLY because
                      row level security protects the data.
   NEVER put the service_role / secret key here, in any file in this folder, or in Git: it bypasses
   all security rules. Leave both empty to run without a backend (sign-in stays disconnected). */
window.CLIO_CONFIG = {
  supabaseUrl: "https://yqrehzvnifvijbheqowh.supabase.co",
  supabaseAnonKey: "sb_publishable_eG_HVVcT9k4eyDozN3h3Fw_yy6KYuzt",
  debug: false, /* true: logs the HTTP status + PostgREST error code of failed saves (no tokens, no project text) */
};
