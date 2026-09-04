import { useTranslation } from 'react-i18next'
import { LegalDocument } from '@/shared/components/legal-document'

const termsDocuments = {
  zh: {
    eyebrow: '法律與政策',
    title: '服務條款',
    summary: '本條款適用於你訪問和使用 SkillHub 提供的技能瀏覽、發布、稽核、下載、賬號管理和 API 相關服務。使用本服務即表示你同意受本條款約束。',
    lastUpdated: '最後更新：2026年3月14日',
    note: '如果你所在組織使用的是私有部署版 SkillHub，該組織還可以在本條款之外增加自己的內部規範、資訊保安要求或可接受使用政策。',
    sections: [
      {
        title: '1. 接受條款與適用範圍',
        paragraphs: [
          '當你訪問、註冊或使用 SkillHub 時，即表示你同意本服務條款以及與之相關的隱私政策和例項運營規則。',
          '如果你代表團隊、公司或其他組織使用 SkillHub，你確認自己有權代表該主體接受這些條款。',
        ],
      },
      {
        title: '2. 賬號與訪問安全',
        paragraphs: [],
        bullets: [
          '你應提供真實、完整且最新的註冊或登入資訊，並妥善保護自己的賬號、密碼、OAuth 會話和 API Token。',
          '你需對透過自己賬號發生的活動負責，包括髮布、稽核、下載、生成令牌和管理名稱空間的操作。',
          '如果你發現未授權訪問、憑據洩露或其他安全事件，應及時通知例項管理員或運營方。',
        ],
      },
      {
        title: '3. 技能、名稱空間與使用者內容',
        paragraphs: [
          '你保留對自己上傳或提交內容的權利，但你授予 SkillHub 一項非獨佔、全球性、可再許可的許可，以便在提供服務所必需的範圍內託管、儲存、複製、處理、展示和分發這些內容。',
          '你承諾對自己提交的技能包、README、描述、截圖、稽核意見和其他材料負責，並保證你有權上傳這些內容。',
        ],
        bullets: [
          '不得上傳惡意程式碼、違法內容、侵權內容、欺詐性內容或故意誤導使用者的材料。',
          '不得冒用他人身份、未經授權佔用名稱空間，或規避平臺的稽核與訪問控制機制。',
          '下載和再分發技能時，你還必須遵守該技能自身的許可證、第三方依賴許可證和適用法律。',
        ],
      },
      {
        title: '4. 稽核、治理與執行',
        paragraphs: [
          'SkillHub 可對發布內容執行稽核、隱藏、下架、拒絕、撤回版本、限制訪問或暫停賬號等治理動作，以維護平臺安全、合規和服務質量。',
          '當存在濫用、侵權、安全風險、違法行為或違反本條款的情況時，平臺或例項管理員可保留相關日誌並採取必要處置。',
        ],
      },
      {
        title: '5. 下載、API 與可接受使用',
        paragraphs: [],
        bullets: [
          '你不得幹擾服務穩定性，不得繞過鑑權、限流、安全策略或未獲授權訪問他人資源。',
          '你不得以破壞性方式抓取、壓測、掃描或自動化呼叫 SkillHub，也不得藉助平臺傳播病毒、木馬或其他惡意負載。',
          '透過 SkillHub 下載的技能由提供者負責，並按其各自的許可證和風險提示使用；你應自行評估相容性、安全性和合規性。',
        ],
      },
      {
        title: '6. 開源元件、智慧財產權與品牌',
        paragraphs: [
          'SkillHub 可能包含受 Apache License 2.0 或其他第三方許可證約束的開源元件，這些元件仍分別受其自身許可證管理。',
          '除非明確說明，SkillHub 的商標、品牌元素、介面設計和站點內容仍歸相應權利人所有，不因你使用服務而轉讓。',
        ],
      },
      {
        title: '7. 服務可用性與免責宣告',
        paragraphs: [
          '我們可以隨時調整、更新、限制或中斷部分功能，包括搜尋、下載、稽核、登入方式和 API 能力，且不保證任何功能持續可用。',
          '在適用法律允許的範圍內，SkillHub 按“現狀”和“可用”提供，不對適銷性、特定用途適用性、不中斷、無錯誤或內容準確性作出明示或默示保證。',
        ],
      },
      {
        title: '8. 責任限制',
        paragraphs: [
          '在適用法律允許的最大範圍內，SkillHub 及其運營方不對任何間接、附帶、特殊、後果性損害或利潤、資料、商譽損失承擔責任。',
          '如果你的使用、內容或違規行為導致第三方向 SkillHub 或例項運營方提出索賠，你同意在法律允許範圍內承擔相應責任並配合處理。',
        ],
      },
      {
        title: '9. 終止、變更與聯絡',
        paragraphs: [
          '你可以隨時停止使用 SkillHub。我們也可以在你違反條款、造成安全風險或法律要求時暫停或終止你對服務的訪問。',
          '我們可能更新本條款。更新後繼續使用服務即表示你接受修訂版本。如需聯絡，請使用當前例項提供的檔案、社群或管理員渠道。',
        ],
      },
    ],
  },
  en: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    summary: 'These terms apply to your access to and use of SkillHub for browsing, publishing, reviewing, downloading, account management, and related API services. By using the service, you agree to these terms.',
    lastUpdated: 'Last updated: March 14, 2026',
    note: 'If your organization runs a private SkillHub deployment, it may impose additional internal rules, information security requirements, or acceptable use policies on top of these baseline terms.',
    sections: [
      {
        title: '1. Acceptance and Scope',
        paragraphs: [
          'By accessing, registering for, or using SkillHub, you agree to these Terms of Service, the related Privacy Policy, and any operating rules for the current instance.',
          'If you use SkillHub on behalf of a team, company, or other organization, you represent that you have authority to accept these terms on its behalf.',
        ],
      },
      {
        title: '2. Accounts and Access Security',
        paragraphs: [],
        bullets: [
          'You must provide accurate and current account information and protect your credentials, OAuth sessions, and API tokens.',
          'You are responsible for activity performed through your account, including publishing, reviewing, downloading, token generation, and namespace administration.',
          'If you become aware of unauthorized access, credential leakage, or another security incident, you must promptly notify the instance administrator or operator.',
        ],
      },
      {
        title: '3. Skills, Namespaces, and User Content',
        paragraphs: [
          'You retain rights in content you upload or submit, but you grant SkillHub a non-exclusive, worldwide, sublicensable license to host, store, copy, process, display, and distribute that content as needed to operate the service.',
          'You are responsible for the skill packages, README files, descriptions, screenshots, review comments, and other materials you submit, and you represent that you have the right to provide them.',
        ],
        bullets: [
          'Do not upload malware, unlawful material, infringing material, deceptive material, or content intended to mislead users.',
          'Do not impersonate others, take namespaces without authorization, or attempt to bypass review, moderation, or access control mechanisms.',
          'When downloading or redistributing a skill, you must also comply with that skill’s own license terms, third-party dependency licenses, and applicable law.',
        ],
      },
      {
        title: '4. Review, Governance, and Enforcement',
        paragraphs: [
          'SkillHub may review content and may approve, reject, hide, remove, yank versions, restrict access, or suspend accounts to protect service security, compliance, and quality.',
          'Where abuse, infringement, security risk, unlawful conduct, or other violations are suspected, the platform or instance administrator may preserve logs and take appropriate action.',
        ],
      },
      {
        title: '5. Downloads, APIs, and Acceptable Use',
        paragraphs: [],
        bullets: [
          'You may not interfere with service stability or bypass authentication, rate limits, security controls, or authorization boundaries.',
          'You may not scrape, stress test, scan, or automate against SkillHub in a destructive manner, or use the service to distribute viruses, trojans, or other malicious payloads.',
          'Skills downloaded through SkillHub are provided by their publishers and are used subject to their own licenses and risk notices. You are responsible for evaluating compatibility, security, and compliance.',
        ],
      },
      {
        title: '6. Open Source Components, Intellectual Property, and Branding',
        paragraphs: [
          'SkillHub may include open-source components governed by Apache License 2.0 or other third-party licenses, and those components remain subject to their respective license terms.',
          'Unless explicitly stated otherwise, SkillHub trademarks, brand assets, interface design, and site content remain the property of their respective owners and are not transferred by your use of the service.',
        ],
      },
      {
        title: '7. Availability and Disclaimers',
        paragraphs: [
          'We may modify, update, limit, or discontinue parts of the service at any time, including search, downloads, review workflows, login methods, and API capabilities, and we do not guarantee continuous availability.',
          'To the maximum extent permitted by law, SkillHub is provided on an "as is" and "as available" basis without express or implied warranties, including warranties of merchantability, fitness for a particular purpose, non-infringement, uninterrupted availability, or accuracy.',
        ],
      },
      {
        title: '8. Limitation of Liability',
        paragraphs: [
          'To the maximum extent permitted by law, SkillHub and its operators will not be liable for indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill.',
          'If claims arise from your use of the service, your content, or your violation of these terms, you agree to bear responsibility as permitted by law and to cooperate in resolving the matter.',
        ],
      },
      {
        title: '9. Termination, Changes, and Contact',
        paragraphs: [
          'You may stop using SkillHub at any time. We may suspend or terminate access if you violate these terms, create security risk, or if required by law.',
          'We may update these terms from time to time. Your continued use after an update means you accept the revised version. If you need to contact us, use the documentation, community, or administrator channel provided by the current instance.',
        ],
      },
    ],
  },
} as const

export function TermsOfServicePage() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage?.split('-')[0] === 'zh' ? 'zh' : 'en'

  return <LegalDocument {...termsDocuments[language]} />
}
