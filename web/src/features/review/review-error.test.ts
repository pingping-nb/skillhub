import { describe, expect, it } from 'vitest'
import { resolveReviewActionErrorDescription } from './review-error'

describe('resolveReviewActionErrorDescription', () => {
  it('returns the error message when present', () => {
    expect(resolveReviewActionErrorDescription(new Error('審核規則校驗失敗'))).toBe('審核規則校驗失敗')
  })

  it('returns undefined for blank or non-error values', () => {
    expect(resolveReviewActionErrorDescription(new Error('   '))).toBeUndefined()
    expect(resolveReviewActionErrorDescription('審核失敗')).toBeUndefined()
  })
})
