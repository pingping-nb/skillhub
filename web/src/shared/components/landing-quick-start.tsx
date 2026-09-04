import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, Check, Copy, Terminal, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCopyToClipboard } from '@/shared/lib/clipboard'
import { resolvePublicRegistryUrl } from '@/shared/lib/registry-url'

type LandingQuickStartTabId = 'agent' | 'human' | 'cli'

interface LandingQuickStartTab {
  id: LandingQuickStartTabId
  label: string
  description: string
  command: string
}

const tabIcons: Record<LandingQuickStartTabId, LucideIcon> = {
  agent: Bot,
  human: UserRound,
  cli: Terminal,
}

/**
 * Get the base URL for the application.
 * Prefers the runtime config if set and not localhost.
 * Falls back to the current page origin.
 */
function getAppBaseUrl(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  const runtimeConfig = window.__SKILLHUB_RUNTIME_CONFIG__
  return resolvePublicRegistryUrl(
    runtimeConfig?.appBaseUrl,
    `${window.location.protocol}//${window.location.host}`,
  )
}

function CompactCopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, copy] = useCopyToClipboard()

  const handleCopy = async () => {
    try {
      await copy(text)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const label = copied ? (t('copyButton.copied') || 'Copied') : (t('copyButton.copy') || 'Copy')

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      title={label}
      className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl border bg-card text-card-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

export function LandingQuickStartSection() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<LandingQuickStartTabId>('agent')
  const baseUrl = useMemo(() => getAppBaseUrl(), [])

  // Build dynamic agent command with actual registry URL
  const agentCommand = t('landing.quickStart.agent.commandTemplate', {
    defaultValue: t('landing.quickStart.agent.command'),
    url: `${baseUrl}/install/skillhub.md`,
  })
  const humanCommand = t('landing.quickStart.human.commandTemplate', {
    defaultValue: t('landing.quickStart.human.command'),
    url: baseUrl,
  })

  const tabs: LandingQuickStartTab[] = [
    {
      id: 'agent',
      label: t('landing.quickStart.tabs.agent'),
      description: t('landing.quickStart.agent.description'),
      command: agentCommand,
    },
    {
      id: 'human',
      label: t('landing.quickStart.tabs.human'),
      description: t('landing.quickStart.human.description'),
      command: humanCommand,
    },
    {
      id: 'cli',
      label: t('landing.quickStart.tabs.cli'),
      description: t('landing.quickStart.cli.description'),
      command: t('landing.quickStart.cli.command'),
    },
  ]

  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]

  return (
    <section className="relative z-10 w-full px-6 py-14 md:py-16" style={{ background: 'var(--bg-page, hsl(var(--background)))' }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-7 md:mb-8">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: 'hsl(var(--foreground))' }}>
            {t('landing.quickStart.title')}
          </h2>
          <p className="text-base md:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>
            {t('landing.quickStart.description', { defaultValue: t('landing.quickStart.subtitle') })}
          </p>
        </div>

        <div
          className="mx-auto max-w-2xl rounded-[28px] border bg-card p-3 text-card-foreground shadow-[0_24px_60px_-28px_hsl(var(--foreground)/0.18)]"
          style={{ borderColor: 'hsl(var(--border-card))' }}
        >
          <div
            className="grid grid-cols-1 gap-2 rounded-2xl bg-muted/70 p-1.5 md:grid-cols-3"
          >
            {tabs.map((tab) => {
              const isActive = tab.id === currentTab.id
              const Icon = tabIcons[tab.id]

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={isActive}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-base font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                  style={{
                    background: isActive ? 'hsl(var(--card))' : 'transparent',
                    color: isActive ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    boxShadow: isActive ? '0 6px 18px hsl(var(--foreground) / 0.08)' : 'none',
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="px-4 pb-4 pt-8 md:px-8 md:pb-6 md:pt-9">
            <p
              className="mx-auto mb-6 max-w-xl text-center text-base font-medium leading-relaxed md:text-lg"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {currentTab.description}
            </p>

            <div
              className="relative rounded-2xl border bg-muted/65 px-4 py-3 pr-16"
              style={{ borderColor: 'hsl(var(--border))' }}
            >
              <div className="overflow-x-auto whitespace-nowrap">
                <code
                  className={`font-mono text-sm md:text-base ${currentTab.id === 'agent' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'}`}
                >
                  {currentTab.command}
                </code>
              </div>
              <CompactCopyButton text={currentTab.command} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
