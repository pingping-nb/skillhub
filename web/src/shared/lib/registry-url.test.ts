/** @vitest-environment jsdom */
import { describe, expect, it, afterEach } from 'vitest'
import { getCliNpmRegistry, resolvePublicRegistryUrl } from './registry-url'

describe('resolvePublicRegistryUrl', () => {
  it('keeps the deployment base path when the runtime public URL is unavailable', () => {
    expect(resolvePublicRegistryUrl('', 'https://registry.example.com', '/skillhub/'))
      .toBe('https://registry.example.com/skillhub')
  })

  it('uses the browser origin plus base path when the configured URL is localhost', () => {
    expect(resolvePublicRegistryUrl('http://localhost:3000', 'https://registry.example.com', '/skillhub/'))
      .toBe('https://registry.example.com/skillhub')
  })

  it('uses a configured non-localhost public URL without a trailing slash', () => {
    expect(resolvePublicRegistryUrl('https://registry.example.com/skillhub/', 'https://ignored.example.com', '/skillhub/'))
      .toBe('https://registry.example.com/skillhub')
  })
})

describe('getCliNpmRegistry', () => {
  const original = window.__SKILLHUB_RUNTIME_CONFIG__

  afterEach(() => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = original
  })

  it('returns the configured registry without a trailing slash', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { cliNpmRegistry: 'http://192.168.22.27:4873/' }
    expect(getCliNpmRegistry()).toBe('http://192.168.22.27:4873')
  })

  it('falls back to the public npm registry when unset', () => {
    window.__SKILLHUB_RUNTIME_CONFIG__ = { cliNpmRegistry: '' }
    expect(getCliNpmRegistry()).toBe('https://registry.npmjs.org')
  })
})
