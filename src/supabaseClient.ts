// src/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

// O Vite expõe as variáveis de ambiente em um objeto global chamado 'import.meta.env'.
// Usamos a sintaxe VITE_ para acessar as chaves que definimos no .env.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as chaves existem antes de criar o cliente
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key not found in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);