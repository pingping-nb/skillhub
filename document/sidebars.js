/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    'index',
    {
      type: 'category',
      label: '快速入門',
      link: {
        type: 'generated-index',
      },
      items: [
        'getting-started/overview',
        'getting-started/quick-start',
        'getting-started/use-cases',
      ],
    },
    {
      type: 'category',
      label: '管理員指南',
      link: {
        type: 'generated-index',
      },
      items: [
        {
          type: 'category',
          label: '部署指南',
          items: [
            'administration/deployment/single-machine',
            'administration/deployment/kubernetes',
            'administration/deployment/configuration',
          ],
        },
        {
          type: 'category',
          label: '安全與合規',
          items: [
            'administration/security/authentication',
            'administration/security/authorization',
            'administration/security/audit-logs',
          ],
        },
        {
          type: 'category',
          label: '治理與運營',
          items: [
            'administration/governance/namespaces',
            'administration/governance/review-workflow',
            'administration/governance/user-management',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '使用者指南',
      link: {
        type: 'generated-index',
      },
      items: [
        {
          type: 'category',
          label: '發布技能',
          items: [
            'user-guide/publishing/create-skill',
            'user-guide/publishing/publish',
            'user-guide/publishing/versioning',
          ],
        },
        {
          type: 'category',
          label: '發現與使用',
          items: [
            'user-guide/discovery/search',
            'user-guide/discovery/install',
            'user-guide/discovery/ratings',
          ],
        },
        {
          type: 'category',
          label: '協作',
          items: [
            'user-guide/collaboration/namespaces',
            'user-guide/collaboration/promotion',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '開發者參考',
      link: {
        type: 'generated-index',
      },
      items: [
        {
          type: 'category',
          label: 'API 參考',
          items: [
            'developer/api/overview',
            'developer/api/public',
            'developer/api/authenticated',
            'developer/api/cli-compat',
          ],
        },
        {
          type: 'category',
          label: '架構設計',
          items: [
            'developer/architecture/overview',
            'developer/architecture/domain-model',
            'developer/architecture/security',
          ],
        },
        {
          type: 'category',
          label: '擴充套件與整合',
          items: [
            'developer/plugins/skill-protocol',
            'developer/plugins/storage-spi',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '參考資料',
      link: {
        type: 'generated-index',
      },
      items: [
        'reference/faq',
        'reference/troubleshooting',
        'reference/changelog',
        'reference/roadmap',
      ],
    },
  ],
};

export default sidebars;
