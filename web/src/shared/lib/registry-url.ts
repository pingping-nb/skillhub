import { BASE_PATH } from './base-path'

/**
 * npm registry that hosts the `@neobards/skillhub` CLI package.
 * The package is published to a private registry, so every `npx`/`npm i`
 * command must pass `--registry` explicitly; otherwise npm falls back to the
 * public registry and fails with E404.
 */
export const CLI_NPM_REGISTRY = 'http://192.168.22.27:4873'

function withoutTrailingSlash(value: string): string {
  return value === '/' ? '' : value.replace(/\/+$/, '')
}

/**
 * Resolves the public registry URL used in copied CLI and agent commands.
 * Runtime configuration wins outside local development; otherwise the current
 * browser origin must retain Vite's deployment base path.
 */
export function resolvePublicRegistryUrl(
  appBaseUrl: string | undefined,
  origin: string,
  basePath = BASE_PATH,
): string {
  const configuredUrl = appBaseUrl?.trim()
  if (configuredUrl && !configuredUrl.includes('localhost')) {
    return withoutTrailingSlash(configuredUrl)
  }

  return `${withoutTrailingSlash(origin)}${withoutTrailingSlash(basePath)}`
}
