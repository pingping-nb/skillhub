import { describe, expect, it } from 'vitest'
import {
  extractPrecheckWarnings,
  isFrontmatterFailureMessage,
  isPrecheckConfirmationMessage,
  isPrecheckFailureMessage,
  isVersionExistsMessage,
} from './publish-error-utils'

describe('publish-error-utils', () => {
  it('detects confirmation-required warnings in English', () => {
    expect(isPrecheckConfirmationMessage('Pre-publish warnings require confirmation before publishing:\n- warning')).toBe(true)
  })

  it('detects confirmation-required warnings in Chinese', () => {
    expect(isPrecheckConfirmationMessage('預發布發現以下風險提醒，確認後仍可繼續發布：\n- 風險提醒')).toBe(true)
  })

  it('extracts warning lines from a confirmation message', () => {
    expect(extractPrecheckWarnings(
      'Pre-publish warnings require confirmation before publishing:\n- Disallowed file extension: malware.exe\n- SKILL.md line 5 contains a value that looks like a secret or token.'
    )).toEqual([
      'Disallowed file extension: malware.exe',
      'SKILL.md line 5 contains a value that looks like a secret or token.',
    ])
  })

  it('keeps existing blocking precheck detection', () => {
    expect(isPrecheckFailureMessage('Pre-publish validation failed: validator blocked publish')).toBe(true)
  })

  it('keeps version and frontmatter detection helpers', () => {
    expect(isVersionExistsMessage('Version already exists')).toBe(true)
    expect(isFrontmatterFailureMessage('Invalid SKILL.md frontmatter')).toBe(true)
  })
})
