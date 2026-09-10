import { PKG_NAME, PKG_VERSION } from '../generated/pkg-info'

/**
 * Default SkillHub registry endpoint. Override with the `SKILLHUB_REGISTRY`
 * environment variable (e.g. for an internal/self-hosted deployment) instead of
 * hardcoding an environment-specific host here.
 */
export const DEFAULT_REGISTRY = process.env.SKILLHUB_REGISTRY?.trim() || 'https://skill.xfyun.cn'
export const CLI_VERSION: string = PKG_VERSION
export const CLI_PACKAGE_NAME: string = PKG_NAME
export const EXIT = {
  generic: 1,
  auth: 2,
  network: 3,
  filesystem: 4,
  usage: 5,
  validation: 6
} as const
