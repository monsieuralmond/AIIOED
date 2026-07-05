export type LocalResearchStorageEnv = {
  readonly DEV: boolean;
  readonly VITE_USE_LOCAL_RESEARCH_STORAGE?: string;
};

export const localResearchStorageEnabled = (env: LocalResearchStorageEnv): boolean =>
  env.DEV && env.VITE_USE_LOCAL_RESEARCH_STORAGE === "1";

export const useLocalResearchStorage = localResearchStorageEnabled(import.meta.env);
