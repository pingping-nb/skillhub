import { describe, expect, it } from 'vitest'
import en from './locales/en.json'
import zh from './locales/zh.json'

describe('landing quick start locales', () => {
  it('uses localized agent setup prompts for chinese and english', () => {
    expect(zh.landing.quickStart.agent.command).toBe('閱讀 https://www.example.com/registry/skill.md，並按照說明完成 SkillHub Skills Registry 的配置')
    expect(en.landing.quickStart.agent.command).toBe('Read https://www.example.com/registry/skill.md and follow the instructions to setup SkillHub Skills Registry')
  })

  it('provides command templates with url placeholder for dynamic rendering', () => {
    expect(zh.landing.quickStart.agent.commandTemplate).toBe('閱讀 {{url}}，並按照說明完成 SkillHub Skills Registry 的配置')
    expect(en.landing.quickStart.agent.commandTemplate).toBe('Read {{url}} and follow the instructions to setup SkillHub Skills Registry')
  })

  it('exposes CLI install command in both locales', () => {
    expect(zh.landing.quickStart.tabs.cli).toBe('CLI')
    expect(zh.landing.quickStart.cli.command).toBe('npm i -g @astron-team/skillhub')
    expect(zh.landing.quickStart.cli.description).toBe('安裝 SkillHub CLI 到本地，後續可執行 skillhub install 安裝技能')
    expect(en.landing.quickStart.tabs.cli).toBe('CLI')
    expect(en.landing.quickStart.cli.command).toBe('npm i -g @astron-team/skillhub')
    expect(en.landing.quickStart.cli.description).toBe('Install the SkillHub CLI locally to run skillhub install for skills.')
  })
})
