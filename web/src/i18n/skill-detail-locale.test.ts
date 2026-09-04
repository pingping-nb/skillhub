import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import zh from './locales/zh.json'

describe('skill detail lifecycle locales', () => {
  it('defines the unarchive label in both locales', () => {
    expect(zh.skillDetail.unarchiveSkill).toBe('恢復技能')
    expect(en.skillDetail.unarchiveSkill).toBe('Restore Skill')
  })

  it('defines package relative link missing messages in both locales', () => {
    expect(zh.skillDetail.packageLinkMissingTitle).toBe('檔案未找到')
    expect(zh.skillDetail.packageLinkMissingDescription).toBe('該連結指向的檔案不在當前技能版本中。')
    expect(en.skillDetail.packageLinkMissingTitle).toBe('File not found')
    expect(en.skillDetail.packageLinkMissingDescription).toBe('This link points to a file that is not included in the current skill version.')
  })
})
