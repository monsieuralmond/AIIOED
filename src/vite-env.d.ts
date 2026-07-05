/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_LOCAL_RESEARCH_STORAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
