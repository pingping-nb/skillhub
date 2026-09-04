import { describe, expect, it } from 'vitest'
import skillGuide from '../docs/skill.md?raw'
import skillGuideTemplate from '../docs/skill.md.template?raw'
import en from './locales/en.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'
import zhCN from './locales/zh-CN.json'

describe('landing quick start locales', () => {
  it('uses localized agent setup prompts for chinese, english, and russian', () => {
    expect(zh.landing.quickStart.agent.command).toBe('請根據 https://www.example.com/install/skillhub.md 接入 SkillHub')
    expect(zhCN.landing.quickStart.agent.command).toBe('请根据 https://www.example.com/install/skillhub.md 接入 SkillHub')
    expect(en.landing.quickStart.agent.command).toBe('Connect SkillHub using https://www.example.com/install/skillhub.md')
    expect(ru.landing.quickStart.agent.command).toBe('Подключите SkillHub по инструкции https://www.example.com/install/skillhub.md')
  })

  it('provides command templates with url placeholder for dynamic rendering', () => {
    expect(zh.landing.quickStart.agent.commandTemplate).toBe('請根據 {{url}} 接入 SkillHub')
    expect(zhCN.landing.quickStart.agent.commandTemplate).toBe('请根据 {{url}} 接入 SkillHub')
    expect(en.landing.quickStart.agent.commandTemplate).toBe('Connect SkillHub using {{url}}')
    expect(ru.landing.quickStart.agent.commandTemplate).toBe('Подключите SkillHub по инструкции {{url}}')
    expect(zh.landing.quickStart.human.commandTemplate).toContain('--registry {{url}}')
    expect(zhCN.landing.quickStart.human.commandTemplate).toContain('--registry {{url}}')
    expect(en.landing.quickStart.human.commandTemplate).toContain('--registry {{url}}')
    expect(ru.landing.quickStart.human.commandTemplate).toContain('--registry {{url}}')
  })

  it('keeps exact skill installs on the selected registry', () => {
    for (const prompt of [
      zh.skillDetail.installForAgent.prompt,
      zhCN.skillDetail.installForAgent.prompt,
      en.skillDetail.installForAgent.prompt,
      ru.skillDetail.installForAgent.prompt,
    ]) {
      expect(prompt).toContain('{{guideUrl}}')
      expect(prompt).toContain('{{skill}}')
      expect(prompt).toContain('{{version}}')
      expect(prompt).not.toContain('fallback')
      expect(prompt).not.toContain('备用公共')
      expect(prompt).not.toMatch(/若无法安装|If installation fails|Если установка не удалась/)
      expect(prompt).not.toMatch(/不要改用其他来源|do not use another source|не используйте другой источник/)
    }
  })

  it('limits fallback to discovery in both served guide sources', () => {
    for (const guide of [skillGuide, skillGuideTemplate]) {
      expect(guide).toContain('version: 1.1.1')
      expect(guide).toContain('Fallback is only appropriate for discovery requests')
      expect(guide).toContain('For an exact coordinate or version request, report the failure and stop')
    }
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
