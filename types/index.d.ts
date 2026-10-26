export type MascotFrame = number

declare module 'claude-code' {
  interface PluginState {
    'omp-mascot': { frame: MascotFrame }
  }
}
