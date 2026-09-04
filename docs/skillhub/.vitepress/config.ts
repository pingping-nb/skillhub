import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'SkillHub',
  description: 'Enterprise Self-hosted Agent Skill Registry',
  base: '/skillhub/',
  ignoreDeadLinks: [/^http:\/\/localhost/],

  head: [],
  vite: {
    build: {
      target: 'es2020',
    },
  },

  // Define root locale for redirect
  locales: {
    root: {
      label: '中文',
      lang: 'zh-CN',
      description: '企業級自託管 Agent Skill 註冊中心',
      themeConfig: {
        nav: [
          { text: '首頁', link: '/' },
          { text: '快速開始', link: '/quickstart' },
          { text: '功能指南', link: '/guide/skill-publish' },
          { text: '開源週報', link: 'https://iflytek.github.io/skillhub/weekly/' },
          { text: 'FAQ', link: '/faq' },
        ],
        sidebar: [
          {
            text: '開始使用',
            items: [
              { text: '專案簡介', link: '/introduction' },
              { text: '快速開始', link: '/quickstart' },
            ],
          },
          {
            text: '核心功能',
            items: [
              { text: 'Skill 發布與版本管理', link: '/guide/skill-publish' },
              { text: 'Skill 搜尋與發現', link: '/guide/skill-discovery' },
              { text: '名稱空間與團隊管理', link: '/guide/namespace' },
              { text: '稽核與治理', link: '/guide/review' },
              { text: '安全掃描', link: '/guide/scanner' },
              { text: '使用者互動與社交', link: '/guide/social' },
              { text: 'Runtime 整合契約', link: '/guide/runtime-integration' },
            ],
          },
          {
            text: '更多',
            items: [
              { text: 'Kubernetes 部署', link: '/guide/kubernetes' },
              { text: '常見問題', link: '/faq' },
            ],
          },
        ],
        outline: { label: '頁面導航', level: [2, 3] },
        lastUpdated: { text: '最後更新' },
        docFooter: { prev: '上一頁', next: '下一頁' },
        footer: { message: '版權所有 © 科大訊飛股份有限公司' },
      },
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/',
      description: 'Enterprise Self-hosted Agent Skill Registry',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Quick Start', link: '/en/quickstart' },
          { text: 'Guide', link: '/en/guide/skill-publish' },
          { text: 'Weekly Reports', link: 'https://iflytek.github.io/skillhub/weekly/' },
          { text: 'FAQ', link: '/en/faq' },
        ],
        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/en/introduction' },
              { text: 'Quick Start', link: '/en/quickstart' },
            ],
          },
          {
            text: 'Core Features',
            items: [
              { text: 'Skill Publishing & Versioning', link: '/en/guide/skill-publish' },
              { text: 'Skill Search & Discovery', link: '/en/guide/skill-discovery' },
              { text: 'Namespace & Team Management', link: '/en/guide/namespace' },
              { text: 'Review & Governance', link: '/en/guide/review' },
              { text: 'Security Scanning', link: '/en/guide/scanner' },
              { text: 'Social & Interaction', link: '/en/guide/social' },
              { text: 'Runtime Integration Contract', link: '/en/guide/runtime-integration' },
            ],
          },
          {
            text: 'More',
            items: [
              { text: 'Kubernetes Deployment', link: '/en/guide/kubernetes' },
              { text: 'FAQ', link: '/en/faq' },
            ],
          },
        ],
        outline: { label: 'On this page', level: [2, 3] },
        lastUpdated: { text: 'Last updated' },
        docFooter: { prev: 'Previous', next: 'Next' },
        footer: { message: 'Copyright © iFlytek Co., Ltd.' },
      },
    },
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/iflytek/skillhub' },
    ],

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜尋檔案' },
              modal: {
                noResultsText: '未找到結果',
                resetButtonTitle: '清除搜尋',
                footer: { selectText: '選擇', navigateText: '切換' },
              },
            },
          },
        },
      },
    },
  },
})
