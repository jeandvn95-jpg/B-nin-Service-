import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    "Variables Supabase manquantes : vérifie VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans ton fichier .env (voir .env.example)."
  );
}

export const supabase = createClient(url, key);
