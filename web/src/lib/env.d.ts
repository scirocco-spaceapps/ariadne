interface ImportMetaEnv {
  readonly VITE_PLANNER_URL?: string
  readonly VITE_MC_URL?: string
  readonly VITE_ASSETS_URL?: string
  readonly VITE_DEMO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
