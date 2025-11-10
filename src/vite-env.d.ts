// src/env.d.ts (ou onde estiver sua tipagem de ambiente)

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  // adicione outras variáveis VITE_ aqui
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}