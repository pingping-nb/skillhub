# SkillHub 內建 Skills 候選池

> 目標：從公開來源中篩出 30～50 個可合法再分發、真實可用的 Skill，隨 SkillHub 預設部署提供。
>
> 初篩日期：2026-07-30
>
> 建設原則與驗收標準見：[SkillHub 內建優質 Skills 建設計劃](./21-official-starter-skills-plan.md)
>
> 首輪審計結果見：[內建 Skill 候選第一輪質量與安全實測報告](./23-builtin-skills-first-round-test-report.md)

## 1. 初篩結論

本輪共整理 70 個候選，分成四組：

| 分組 | 數量 | 含義 |
|---|---:|---|
| A：優先實測 | 15 | 來源和許可證相對清楚、依賴較少，先做包級審查和真實任務測試 |
| B：擴充套件實測 | 25 | 場景有價值，但需要適配、安裝工具或進一步核驗 |
| C：條件候選 | 20 | 依賴賬號、金鑰、特定平臺，或許可證仍需補證 |
| D：不納入 | 10 | 許可證不允許、外部寫操作風險高，或過於平臺專屬 |

A、B 兩組只是測試前的實測佇列，不等於已經批准內建。首輪審計最終得到 `include 3 / adapt 29 /
hold 16 / reject 22`；第一批從 `include` 和低成本 `adapt` 項中選出 15 個。

### 第一批最終選定：15 個

第一輪測試後，不再沿用原 A 組作為第一批清單。最終選定 3 個接近可直接打包的候選和 12 個
低成本適配候選：

| 編號 | Skill | 主要場景 | 首輪結論 | 適配要求（已完成） |
|---|---|---|---|---|
| A05 | `exam-ready` | 學習與備考 | include | 補許可證後設資料和外部內容防注入說明 |
| A07 | `ai-claim-checker` | 資訊核查 | adapt | 修正來源示例、弱化強制流程，補 CC BY-SA 歸屬 |
| A08 | `decision-matrix` | 工作與日常決策 | adapt | 修正示例算分，增加高風險決策免責宣告 |
| A09 | `storytelling-advisor` | 寫作與表達 | adapt | 明確區分使用者事實和創作補充，禁止暗中虛構 |
| A10 | `linkedin-post-formatter` | 社交內容 | adapt | 普通文字作為預設輸出，樣式改為顯式選擇 |
| A11 | `documentation-writer` | 辦公檔案 | adapt | 輸入充分時直接起草，不強制重複提問和審批大綱 |
| A12 | `diagram-maker` | 流程圖與結構圖 | adapt | 增加輸出防覆蓋，去除 OpenClaw 路徑約定 |
| A13 | `weather` | 日常與出行天氣 | include | 補來源和許可證後設資料 |
| A14 | `video-frames` | 影片抽幀 | adapt | 增加 `--index` 校驗和輸出防覆蓋 |
| A15 | `frontend-design` | 介面與創意設計 | adapt | 刪除隱式讀取 human memory 的指令 |
| B06 | `daily-standup-journal` | 日報與個人覆盤 | adapt | 預設不跨日儲存或推斷，持久化必須由使用者選擇 |
| B07 | `time-blocking-scheduler` | 個人時間管理 | adapt | 刪除固定節律規則，優先使用使用者作息和約束 |
| B10 | `retrieval-practice-generator` | 主動回憶練習 | include | 補 CC BY-SA 歸屬、同許可和修改宣告 |
| B11 | `study-strategy-selector` | 學習策略 | adapt | 修正過度絕對的學習科學表述，補 CC BY-SA 歸屬 |
| B24 | `meeting-note-summarizer` | 會議摘要與行動項 | adapt | 禁止補造負責人、日期、時長和任務，未知項明確標註 |

這 15 項的適配後原始碼和歸屬資訊現已納入 `builtin-skills/skills/`，最終複測結果見
[測試報告第 6 節](./23-builtin-skills-first-round-test-report.md#6-第一批-15-個適配包複測)。

組合分佈：

- 學習與研究：A05、A07、B10、B11，共 4 個。
- 辦公與個人效率：A08、A11、B06、B07、B24，共 5 個。
- 內容與設計：A09、A10、A12、A15，共 4 個。
- 日常出行與媒體：A13、A14，共 2 個。

沒有選擇 A06，是因為它與 B10、B11 的學習流程重疊；沒有選擇 B01，是因為主題對比度和實際應用
機制尚未成立；沒有選擇 C10，是因為首批已有 A15，且 C10 仍有 cookie 示例和許可證問題。
旅行規劃候選 B25 已在實測中失敗，不因場景缺口重新納入。

當前 manifest 中的兩個包也不計入上述數量：

- `skillhub-hello` 是教學演示內容，可以保留作部署驗證，但不計入 30～50 個實用 Skill。
- `agentguard` 包含 Node.js 依賴和較廣的檔案、命令訪問範圍，完成獨立安全與相容性複核後再決定
  是否計入。

## 2. 去哪裡找

優先從這些可追溯的上游倉庫找，不直接從聚合站按熱度批次搬運：

| 來源 | 適合場景 | 許可證結論 | 使用方式 |
|---|---|---|---|
| [GitHub Awesome Copilot](https://github.com/github/awesome-copilot/tree/main/skills) | 辦公、寫作、學習、業務 | 倉庫為 [MIT](https://github.com/github/awesome-copilot/blob/main/LICENSE) | 主要候選源 |
| [OpenClaw Skills](https://github.com/openclaw/openclaw/tree/main/skills) | 工具、媒體、資訊獲取、個人應用 | 倉庫為 [MIT](https://github.com/openclaw/openclaw/blob/main/LICENSE) | 逐項檢查 CLI、賬號和作業系統依賴 |
| [Anthropic Skills](https://github.com/anthropics/skills/tree/main/skills) | 辦公、設計、開發 | 逐 Skill 授權；部分 Apache-2.0，檔案處理四項不可再分發 | 只採用明確允許再分發的目錄 |
| [Education Agent Skills](https://github.com/GarethManning/education-agent-skills/tree/main/skills) | 學習方法、批判性思考 | [CC BY-SA 4.0](https://github.com/GarethManning/education-agent-skills#licence) | 保留署名和許可證連結、標明是否修改，並以相同許可證分發 |
| [Mercury Agent Skills](https://github.com/cosmicstack-labs/mercury-agent-skills) | 個人效率、職業、內容、業務 | 倉庫為 [MIT](https://github.com/cosmicstack-labs/mercury-agent-skills/blob/main/LICENSE) | 選擇短小、無外部副作用的 Skill |
| [OpenAI Skills Catalog](https://github.com/openai/skills) | 檔案、部署、安全、研究與協作 | 逐 Skill 授權，不能把倉庫內容統一視為同一許可證 | 後續按單個目錄核對許可證和工具依賴 |
| [OpenAI Plugins](https://github.com/openai/plugins) | Notion、GitHub、OpenAI 開發 | 本文候選已逐項核實為 MIT 或 Apache-2.0；其他內容不自動視為可再分發 | 多數依賴 connector 或平臺賬號，作為條件候選 |
| [skills.sh](https://skills.sh/) | 跨倉庫發現 | 聚合結果本身不代表可再分發 | 只用來發現，再回上游倉庫複核 |

本輪沒有從 OpenAI Skills Catalog 和 Vercel Agent Skills 選入首批內容；後續補充候選時，仍需
逐項核對許可證、工具依賴和跨 Agent 可用性。

## 3. A 組：原首輪 15 個優先實測佇列

以下是測試前確定的首輪佇列，不再代表最終第一批。最終入選項以上文“第一批最終選定”為準。

| 編號 | Skill | 場景 | 來源 / 許可 | 主要門檻 |
|---|---|---|---|---|
| A01 | [internal-comms](https://github.com/anthropics/skills/tree/main/skills/internal-comms) | 工作彙報、FAQ、事故通報 | Anthropic / Apache-2.0 | 無硬依賴；檢查其中的組織專屬假設 |
| A02 | [meeting-minutes](https://github.com/github/awesome-copilot/tree/main/skills/meeting-minutes) | 會議紀要與行動項 | Awesome Copilot / MIT | 無硬依賴；以會議文字為輸入 |
| A03 | [brag-sheet](https://github.com/github/awesome-copilot/tree/main/skills/brag-sheet) | 個人成果記錄、述職準備 | Awesome Copilot / MIT | 無硬依賴 |
| A04 | [convert-plaintext-to-md](https://github.com/github/awesome-copilot/tree/main/skills/convert-plaintext-to-md) | 將雜亂文字整理為 Markdown | Awesome Copilot / MIT | 無硬依賴 |
| A05 | [exam-ready](https://github.com/github/awesome-copilot/tree/main/skills/exam-ready) | 複習計劃與考前檢查 | Awesome Copilot / MIT | 無硬依賴；避免承諾學習結果 |
| A06 | [spaced-practice-scheduler](https://github.com/GarethManning/education-agent-skills/tree/main/skills/memory-learning-science/spaced-practice-scheduler) | 間隔複習計劃 | Education Agent Skills / CC BY-SA 4.0 | 無硬依賴；按來源表要求歸因和標註修改 |
| A07 | [ai-claim-checker](https://github.com/GarethManning/education-agent-skills/tree/main/skills/student-learning/ai-claim-checker) | 檢查 AI 回答中的主張 | Education Agent Skills / CC BY-SA 4.0 | 按來源表要求歸因；明確“核查”不等於自動證明 |
| A08 | [decision-matrix](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/creative-personal-development/decision-matrix) | 日常和工作決策比較 | Mercury / MIT | 無硬依賴 |
| A09 | [storytelling-advisor](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/creative-personal-development/storytelling-advisor) | 故事結構與表達改進 | Mercury / MIT | 無硬依賴 |
| A10 | [linkedin-post-formatter](https://github.com/github/awesome-copilot/tree/main/skills/linkedin-post-formatter) | 社交內容排版 | Awesome Copilot / MIT | 無硬依賴；只生成草稿，不自動發布 |
| A11 | [documentation-writer](https://github.com/github/awesome-copilot/tree/main/skills/documentation-writer) | 專案檔案與使用說明 | Awesome Copilot / MIT | 需要使用者提供專案上下文 |
| A12 | [diagram-maker](https://github.com/openclaw/openclaw/tree/main/skills/diagram-maker) | 流程圖、結構圖 | OpenClaw / MIT | 無賬號和金鑰；驗證不同 Agent 的製圖能力 |
| A13 | [weather](https://github.com/openclaw/openclaw/tree/main/skills/weather) | 日常和出行天氣查詢 | OpenClaw / MIT | 需要聯網和 `curl` 或等價網頁獲取能力 |
| A14 | [video-frames](https://github.com/openclaw/openclaw/tree/main/skills/video-frames) | 影片抽幀與片段提取 | OpenClaw / MIT | 需要 FFmpeg |
| A15 | [frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | 高質量介面設計 | Anthropic / Apache-2.0 | 無硬依賴；檢查並移除宿主產品專屬表述 |

首批刻意不放旅行預訂、發郵件、自動發布和雲端寫入類 Skill。這些操作需要賬號、憑據和使用者確認，
不符合第一批“低依賴、低副作用”的目標。

## 4. B 組：擴充套件到 40 個的實測佇列

| 編號 | Skill | 場景 | 來源 / 許可 | 進入正式內建前要解決 |
|---|---|---|---|---|
| B01 | [theme-factory](https://github.com/anthropics/skills/tree/main/skills/theme-factory) | 檔案和網頁主題 | Anthropic / Apache-2.0 | 驗證跨 Agent 輸出 |
| B02 | [algorithmic-art](https://github.com/anthropics/skills/tree/main/skills/algorithmic-art) | p5.js 生成藝術 | Anthropic / Apache-2.0 | 需要瀏覽器和 p5.js |
| B03 | [canvas-design](https://github.com/anthropics/skills/tree/main/skills/canvas-design) | 海報與靜態視覺 | Anthropic / Apache-2.0；字型另有 OFL | 包體較大，逐項核驗字型許可 |
| B04 | [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | 建立和最佳化 Skill | Anthropic / Apache-2.0 | 去除 Claude 專屬假設並驗證指令碼 |
| B05 | [webapp-testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | 本地 Web 應用測試 | Anthropic / Apache-2.0 | Python、Playwright、瀏覽器 |
| B06 | [daily-standup-journal](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/creative-personal-development/daily-standup-journal) | 日報、站會整理 | Mercury / MIT | 與會議紀要候選做去重測試 |
| B07 | [time-blocking-scheduler](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/creative-personal-development/time-blocking-scheduler) | 個人時間塊安排 | Mercury / MIT | 只生成計劃，不直接寫日曆 |
| B08 | [resume-writing](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/career/resume-writing) | 簡歷撰寫 | Mercury / MIT | 驗證不同職位和語言 |
| B09 | [interview-prep](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/career/interview-prep) | 求職面試準備 | Mercury / MIT | 避免虛構經歷 |
| B10 | [retrieval-practice-generator](https://github.com/GarethManning/education-agent-skills/tree/main/skills/memory-learning-science/retrieval-practice-generator) | 主動回憶練習 | Education Agent Skills / CC BY-SA 4.0 | 按來源表要求歸因、標註修改並同許可分發 |
| B11 | [study-strategy-selector](https://github.com/GarethManning/education-agent-skills/tree/main/skills/self-regulated-learning/study-strategy-selector) | 選擇學習策略 | Education Agent Skills / CC BY-SA 4.0 | 按來源表要求歸因、標註修改並同許可分發 |
| B12 | [research-planner](https://github.com/NKZ55/research-planner/tree/main/skills/research-planner) | 研究問題與計劃 | NKZ55 / MIT | 核驗引用和檢索假設 |
| B13 | [md-to-docx](https://github.com/github/awesome-copilot/tree/main/skills/md-to-docx) | Markdown 轉 Word | Awesome Copilot / MIT | Node.js 18+、`docx>=9`、`marked>=15` |
| B14 | [convert-word-to-md](https://github.com/github/awesome-copilot/tree/main/skills/convert-word-to-md) | Word 轉 Markdown | Awesome Copilot / MIT | Python、`markitdown[docx]>=0.1.0` |
| B15 | [convert-pdf-to-md](https://github.com/github/awesome-copilot/tree/main/skills/convert-pdf-to-md) | PDF 轉 Markdown | Awesome Copilot / MIT | Python、`markitdown[pdf]>=0.1.0`、`pymupdf>=1.24.0`；掃描件另配 OCR |
| B16 | [convert-excel-to-md](https://github.com/github/awesome-copilot/tree/main/skills/convert-excel-to-md) | Excel 轉 Markdown | Awesome Copilot / MIT | Python、`markitdown[xlsx]>=0.1.0` |
| B17 | [markdown-to-html](https://github.com/github/awesome-copilot/tree/main/skills/markdown-to-html) | Markdown 轉網頁 | Awesome Copilot / MIT | 核驗指令碼和 HTML 安全 |
| B18 | [ad-campaign-analyzer](https://github.com/github/awesome-copilot/tree/main/skills/ad-campaign-analyzer) | 廣告活動分析 | Awesome Copilot / MIT | 需要使用者提供資料；避免外部自動投放 |
| B19 | [gtm-positioning-strategy](https://github.com/github/awesome-copilot/tree/main/skills/gtm-positioning-strategy) | 產品定位 | Awesome Copilot / MIT | 無硬依賴；驗證輸出不空泛 |
| B20 | [competitor-ad-intelligence](https://github.com/github/awesome-copilot/tree/main/skills/competitor-ad-intelligence) | 競品廣告研究 | Awesome Copilot / MIT | 需要聯網；遵守目標站點條款 |
| B21 | [blogwatcher](https://github.com/openclaw/openclaw/tree/main/skills/blogwatcher) | 部落格和 RSS 更新追蹤 | OpenClaw / MIT | 需要 `blogwatcher` CLI |
| B22 | [openai-whisper](https://github.com/openclaw/openclaw/tree/main/skills/openai-whisper) | 本地音訊轉寫 | OpenClaw / MIT | 本地 Whisper、模型下載和算力 |
| B23 | [songsee](https://github.com/openclaw/openclaw/tree/main/skills/songsee) | 音訊視覺化 | OpenClaw / MIT | 需要對應 CLI；驗證跨平臺 |
| B24 | [meeting-note-summarizer](https://github.com/cosmicstack-labs/mercury-agent-skills/tree/main/categories/creative-personal-development/meeting-note-summarizer) | 將會議筆記整理成摘要和行動項 | Mercury / MIT | 與 A02 做去重測試，只保留效果更好的一個 |
| B25 | [travel-planner](https://github.com/ailabs-393/ai-labs-claude-skills/tree/main/packages/skills/travel-planner) | 旅行行程規劃 | AI Labs / MIT | Python 3、聯網；移除寫入 `~/.claude/travel_planner/` 的持久化邏輯後再測 |

B25 的核心行程生成實測失敗，並會把敏感旅行畫像寫入宿主目錄，首輪結論為 `reject`。旅行場景
另找質量更高的候選，不再以 B25 作為適配起點。

## 5. C 組：20 個條件候選

這些 Skill 只有在依賴、授權或互動邊界解決後才進入 A/B 組。

| 編號 | Skill | 暫緩原因 |
|---|---|---|
| C01 | [notion-knowledge-capture](https://github.com/openai/plugins/tree/main/plugins/notion/skills/notion-knowledge-capture) | MIT；依賴 Notion connector、賬號和工作區 |
| C02 | [notion-meeting-intelligence](https://github.com/openai/plugins/tree/main/plugins/notion/skills/notion-meeting-intelligence) | MIT；依賴 Notion connector 和賬號 |
| C03 | [notion-research-documentation](https://github.com/openai/plugins/tree/main/plugins/notion/skills/notion-research-documentation) | MIT；依賴 Notion connector 和賬號 |
| C04 | [notion-spec-to-implementation](https://github.com/openai/plugins/tree/main/plugins/notion/skills/notion-spec-to-implementation) | MIT；依賴 Notion connector 和專案上下文 |
| C05 | [gh-address-comments](https://github.com/openai/plugins/tree/main/plugins/github/skills/gh-address-comments) | Apache-2.0；需要 `gh`、GitHub 登入和本地倉庫 |
| C06 | [gh-fix-ci](https://github.com/openai/plugins/tree/main/plugins/github/skills/gh-fix-ci) | Apache-2.0；需要 `gh`、Actions 和本地構建環境 |
| C07 | [mcp-builder](https://github.com/anthropics/skills/tree/main/skills/mcp-builder) | Apache-2.0；需要 Python/Node，並含 Claude 專屬假設 |
| C08 | [slack-gif-creator](https://github.com/anthropics/skills/tree/main/skills/slack-gif-creator) | Apache-2.0；需要 Python、Pillow、imageio、FFmpeg、NumPy |
| C09 | [deploy-to-vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/deploy-to-vercel) | 有外部部署寫操作；倉庫許可證檔案待補 |
| C10 | [vercel-react-best-practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | 內容適合內建，但倉庫許可證檔案待補 |
| C11 | [writing-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/writing-guidelines) | 執行時讀取遠端規則；倉庫許可證檔案待補 |
| C12 | [summarize](https://github.com/openclaw/openclaw/tree/main/skills/summarize) | 需要 `summarize` CLI 及 OpenAI、Anthropic、xAI 或 Gemini 等模型 API key |
| C13 | [goplaces](https://github.com/openclaw/openclaw/tree/main/skills/goplaces) | 需要 CLI、Google Places API 憑據和已啟用計費的雲專案，會產生費用 |
| C14 | [obsidian](https://github.com/openclaw/openclaw/tree/main/skills/obsidian) | 需要 Obsidian 1.12.7+、官方 CLI 和執行中的桌面應用，並會建立、編輯、移動或刪除本地筆記 |
| C15 | [notion](https://github.com/openclaw/openclaw/tree/main/skills/notion) | 需要 token 或 `ntn login`，可讀取、更新、上傳和刪除工作區內容 |
| C16 | [apple-notes](https://github.com/openclaw/openclaw/tree/main/skills/apple-notes) | 僅 macOS，需要 Automation 許可權，並可編輯、移動、匯出或刪除私人筆記 |
| C17 | [apple-reminders](https://github.com/openclaw/openclaw/tree/main/skills/apple-reminders) | 僅 macOS，並會修改提醒事項 |
| C18 | [trello](https://github.com/openclaw/openclaw/tree/main/skills/trello) | 需要 Trello 賬號和 API 憑據，並有外部寫操作 |
| C19 | [spotify-player](https://github.com/openclaw/openclaw/tree/main/skills/spotify-player) | 需要 Spotify Premium 和 `spogo`，推薦認證方式會匯入瀏覽器 Cookie |
| C20 | [openai-whisper-api](https://github.com/openclaw/openclaw/tree/main/skills/openai-whisper-api) | 需要 API key、會產生費用，並會把錄音上傳到外部 OpenAI 或相容 API |

## 6. D 組：10 個明確不納入

| 編號 | Skill | 不納入原因 |
|---|---|---|
| D01 | [yeet](https://github.com/openai/plugins/tree/main/plugins/github/skills/yeet) | 預設執行提交、推送和建立 PR，外部寫操作過強 |
| D02 | [chatgpt-app-submission](https://github.com/openai/plugins/tree/main/plugins/openai-developers/skills/chatgpt-app-submission) | 平臺專屬，並依賴經常變化的提交流程 |
| D03 | [docx](https://github.com/anthropics/skills/tree/main/skills/docx) | All Rights Reserved，不允許作為開源內建包再分發 |
| D04 | [pdf](https://github.com/anthropics/skills/tree/main/skills/pdf) | All Rights Reserved，不允許作為開源內建包再分發 |
| D05 | [pptx](https://github.com/anthropics/skills/tree/main/skills/pptx) | All Rights Reserved，不允許作為開源內建包再分發 |
| D06 | [xlsx](https://github.com/anthropics/skills/tree/main/skills/xlsx) | All Rights Reserved，不允許作為開源內建包再分發 |
| D07 | [vercel-cli-with-tokens](https://github.com/vercel-labs/agent-skills/tree/main/skills/vercel-cli-with-tokens) | 直接處理雲平臺 token，並帶外部寫操作 |
| D08 | [taskflow](https://github.com/openclaw/openclaw/tree/main/skills/taskflow) | 強繫結 OpenClaw 的 `api.runtime.tasks.flow`、ACP 和 session 語義，不能通用移植 |
| D09 | [taskflow-inbox-triage](https://github.com/openclaw/openclaw/tree/main/skills/taskflow-inbox-triage) | 強繫結 OpenClaw 執行時，且主要是包含 Slack 路由的特定示例 |
| D10 | [camsnap](https://github.com/openclaw/openclaw/tree/main/skills/camsnap) | 攝像頭訪問涉及隱私和裝置許可權，不適合作為預設內容 |

## 7. 仍然缺的場景

公開候選最弱的是“無需賬號即可使用”的日常生活、旅行和活動 Skill。市場搜尋能找到不少旅行
規劃器，但多數依賴 API、賬號或宿主持久化目錄。與其硬湊，建議由 SkillHub 基於可複用框架維護
四個小而明確的 Skill，再分別與公開候選做效果對比：

- `trip-planning-brief`：只做目的地、日期、預算、偏好和節奏規劃，不預訂。
- `packing-checklist`：按天氣、天數、活動和人群生成可勾選行李清單。
- `event-planner`：生成聚會或活動的時間線、物料、預算和應急清單。
- `meal-and-grocery-planner`：按人數、飲食限制和預算生成選單與購物清單。

這四個只有在完成內容、測試和許可宣告後才計數，不能先用名字佔滿 30～50 個名額。

## 8. 實際入庫清單

每個 A/B 候選必須逐項完成：

1. 固定到上游 commit SHA，儲存來源、作者和許可證文字。
2. 檢查 `SKILL.md` frontmatter、指令碼、二進位制資源、下載行為、憑據和檔案訪問。
3. 只做必要適配；修改後標明為衍生版本，不冒充上游原作。
4. 在宣告支援的 Agent 中完成至少一個真實任務，並記錄輸入、預期結果和實際結果。
5. 執行 SkillHub 包校驗、安全掃描和人工審查。
6. 使用新版本號打包，上傳不可變的官方 CDN URL。
7. 將不可變 URL 和製品 SHA-256 寫入
   `server/skillhub-app/src/main/resources/builtin-skills/manifest.json`，在乾淨部署中驗證同步、下載和安裝。

第一批 15 個適配包已經完成內容、安全和確定性構建檢查，並已透過官方不可變 CDN URL 和
SHA-256 寫入執行時 manifest。後續更新必須發布新版本和新制品，不得覆蓋當前 URL 對應的位元組。
