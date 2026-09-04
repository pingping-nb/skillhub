import { themes as prismThemes } from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'SkillHub',
  tagline: '企業級 AI 技能登入檔',
  favicon: 'img/favicon.ico',

  url: 'https://skillhub.iflytek.com',
  baseUrl: '/',

  organizationName: 'iflytek',
  projectName: 'skillhub',

  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en'],
    localeConfigs: {
      'zh-CN': {
        label: '中文',
        htmlLang: 'zh-CN',
      },
      'en': {
        label: 'English',
        htmlLang: 'en',
      },
    },
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/iflytek/skillhub/edit/main/document/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/og-image.png',
      navbar: {
        title: 'SkillHub',
        logo: {
          alt: 'SkillHub Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: '檔案',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/iflytek/skillhub',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '檔案',
            items: [
              {
                label: '快速開始',
                to: '/getting-started/quick-start',
              },
              {
                label: '部署指南',
                to: '/administration/deployment/single-machine',
              },
              {
                label: 'API 參考',
                to: '/developer/api/overview',
              },
            ],
          },
          {
            title: '社群',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/iflytek/skillhub',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} iFlytek. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['java', 'bash', 'yaml', 'json'],
      },
    }),
};

export default config;
