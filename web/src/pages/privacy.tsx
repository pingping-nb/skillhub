import { useTranslation } from 'react-i18next'
import { LegalDocument } from '@/shared/components/legal-document'

const privacyDocuments = {
  zh: {
    eyebrow: '法律與隱私',
    title: '隱私政策',
    summary: '本政策說明 SkillHub 在提供技能註冊、發布、稽核、下載、賬號登入和相關 API 服務時，如何收集、使用、共享並保護與你有關的資訊。',
    lastUpdated: '最後更新：2026年3月14日',
    note: '如果你使用的是某個組織自行部署的 SkillHub 例項，該例項的運營方也可能根據其內部政策處理資料，並對其部署環境中的資料承擔獨立責任。',
    sections: [
      {
        title: '1. 適用範圍',
        paragraphs: [
          '本政策適用於 SkillHub 網站、Web 控制檯、公開技能頁面、登入流程、裝置授權流程以及與這些能力相關的介面和服務。',
          '當你瀏覽技能、發布版本、參與稽核、生成令牌或下載內容時，本政策描述我們如何處理與你相關的資訊。',
        ],
      },
      {
        title: '2. 我們收集的資訊',
        paragraphs: [],
        bullets: [
          '賬戶與身份資訊，例如使用者名稱、郵箱、頭像、OAuth 提供方標識、平臺角色和名稱空間成員關係。',
          '你主動提交的內容，例如技能包、README、版本說明、名稱空間資料、評分、星標和稽核意見。',
          '使用與安全資訊，例如 IP 地址、瀏覽器或裝置資訊、請求日誌、下載記錄、登入事件、API Token 後設資料、錯誤日誌和審計日誌。',
        ],
      },
      {
        title: '3. 我們如何使用資訊',
        paragraphs: [],
        bullets: [
          '提供登入、會話管理、許可權控制、裝置授權、賬號安全和基礎客戶支援。',
          '展示公開技能頁面，支援搜尋、下載、評分、星標、名稱空間協作和後臺治理流程。',
          '執行稽核、限流、風控、故障排查、效能分析和產品改進。',
          '在必要時傳送與安全、政策更新或服務可用性相關的重要通知。',
        ],
      },
      {
        title: '4. 公開資訊與共享',
        paragraphs: [
          '你發布為公開的技能、版本說明、名稱空間名稱、公開評分以及部分個人資料資訊，可能會向其他使用者或訪客展示。',
          '除為提供託管、認證、監控、合規支援所必需，或為遵守法律要求、保護平臺與使用者安全外，我們不會出售你的個人資訊。',
          '在私有部署場景中，資料也可能由部署運營方按照其內部治理和合規要求訪問、處理或保留。',
        ],
      },
      {
        title: '5. 資料保留',
        paragraphs: [
          '我們會在實現業務目的所需的期限內保留賬戶資料、技能後設資料、稽核記錄和安全日誌，並可能在法律、審計或合規要求下延長保留期限。',
          '被撤銷的 API Token 將失效，但相關安全與審計記錄可能繼續保留。刪除或下線技能後，備份、副本或日誌中的相關資訊可能在合理週期內繼續存在。',
        ],
      },
      {
        title: '6. 你的選擇與權利',
        paragraphs: [],
        bullets: [
          '你可以更新賬戶資料、修改密碼、撤銷或重新建立 API Token。',
          '你可以聯絡例項管理員申請匯出、更正或刪除與你有關的資訊，但某些記錄可能因安全、審計或合規義務而不能立即刪除。',
          '對於私有部署例項，你的隱私請求通常應優先提交給該例項的運營方或管理員。',
        ],
      },
      {
        title: '7. 安全措施',
        paragraphs: [
          '我們採取合理的技術和組織措施保護資料，例如訪問控制、鑑權、審計、令牌管理和傳輸安全。',
          '但任何網際網路服務都無法保證絕對安全。你應妥善保管賬號憑據，並在發現異常登入、洩露或濫用時及時通知例項運營方。',
        ],
      },
      {
        title: '8. 政策更新與聯絡我們',
        paragraphs: [
          '我們可能隨著產品能力、法律要求或運營方式變化更新本政策。新版政策發布後將在站內適當位置展示，並以頁面標註的更新時間為準。',
          '如需聯絡，請透過當前例項提供的檔案、社群、支援渠道或管理員聯絡方式與 SkillHub 運營方聯絡。',
        ],
      },
    ],
  },
  en: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    summary: 'This policy explains how SkillHub collects, uses, shares, and protects information when we provide skill registry, publishing, review, download, account, and related API services.',
    lastUpdated: 'Last updated: March 14, 2026',
    note: 'If you use a privately deployed SkillHub instance, that deployment operator may also process data under its own internal policies and may act independently for data handled in that environment.',
    sections: [
      {
        title: '1. Scope',
        paragraphs: [
          'This policy applies to the SkillHub website, web console, public skill pages, login flows, device authorization flows, and related APIs and services.',
          'When you browse skills, publish versions, participate in reviews, create tokens, or download content, this policy describes how we handle information related to you.',
        ],
      },
      {
        title: '2. Information We Collect',
        paragraphs: [],
        bullets: [
          'Account and identity information such as username, email, avatar, OAuth provider identifiers, platform roles, and namespace membership.',
          'Content you submit, including skill packages, README files, release notes, namespace profiles, ratings, stars, and review comments.',
          'Usage and security information such as IP address, browser or device details, request logs, download activity, login events, API token metadata, error logs, and audit logs.',
        ],
      },
      {
        title: '3. How We Use Information',
        paragraphs: [],
        bullets: [
          'To provide login, session management, access control, device authorization, account security, and basic support.',
          'To display public skill pages and power search, downloads, ratings, stars, namespace collaboration, and governance workflows.',
          'To perform review operations, rate limiting, abuse prevention, debugging, performance analysis, and service improvement.',
          'To send important notices related to security, policy changes, or service availability when needed.',
        ],
      },
      {
        title: '4. Public Information and Sharing',
        paragraphs: [
          'Skills you publish publicly, release notes, namespace names, public ratings, and some profile information may be visible to other users or visitors.',
          'We do not sell your personal information. We may share information when necessary to provide hosting, authentication, monitoring, or compliance support, or to comply with law and protect the service and its users.',
          'For private deployments, the instance operator may also access, process, or retain data according to its own internal governance and compliance requirements.',
        ],
      },
      {
        title: '5. Data Retention',
        paragraphs: [
          'We retain account information, skill metadata, review records, and security logs for as long as needed to operate the service and may retain them longer where required for legal, audit, or compliance purposes.',
          'Revoked API tokens stop working, but related security and audit records may remain. After a skill is deleted or hidden, residual copies in backups or logs may persist for a reasonable period.',
        ],
      },
      {
        title: '6. Your Choices and Rights',
        paragraphs: [],
        bullets: [
          'You can update account information, change your password, and revoke or recreate API tokens.',
          'You can contact the instance administrator to request export, correction, or deletion of information related to you, although some records may need to be retained for security, audit, or compliance reasons.',
          'For privately deployed instances, privacy requests should usually be directed to that instance operator first.',
        ],
      },
      {
        title: '7. Security Measures',
        paragraphs: [
          'We use reasonable technical and organizational safeguards such as access controls, authentication, auditing, token management, and transport security.',
          'No internet service can guarantee absolute security. You should protect your credentials and report suspicious access, leakage, or misuse promptly to the instance operator.',
        ],
      },
      {
        title: '8. Policy Updates and Contact',
        paragraphs: [
          'We may update this policy as the product, legal requirements, or operating model changes. The latest version will be posted in the service and identified by its update date.',
          'If you need to contact us, use the documentation, community, support channel, or administrator contact information provided by the current SkillHub instance.',
        ],
      },
    ],
  },
} as const

export function PrivacyPolicyPage() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage?.split('-')[0] === 'zh' ? 'zh' : 'en'

  return <LegalDocument {...privacyDocuments[language]} />
}
