import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useCopyToClipboard } from '@/shared/lib/clipboard'
import { resolvePublicRegistryUrl, getCliNpmRegistry } from '@/shared/lib/registry-url'
import { cn } from '@/shared/lib/utils'

export type InstallScope = 'user' | 'project'

/**
 * The npm package name of the SkillHub CLI.
 *
 * Centralized here so the fork's package rename (upstream: `@astron-team/skillhub`)
 * is a single-point change rather than scattered hardcoded strings across the
 * codebase and locale files.
 */
export const SKILLHUB_CLI_PACKAGE = '@neobards/skillhub'

interface InstallCommandProps {
  namespace: string
  slug: string
  version?: string
}

export function buildSkillhubCoordinate(namespace: string, slug: string): string {
  return `@${namespace}/${slug}`
}

/** Restrict copied commands to version tokens that are safe across common shells. */
export function isPortableSkillVersion(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(value)
}

export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return ''
  }
  const runtimeConfig = window.__SKILLHUB_RUNTIME_CONFIG__
  return resolvePublicRegistryUrl(
    runtimeConfig?.appBaseUrl,
    `${window.location.protocol}//${window.location.host}`,
  )
}

export function buildSkillhubInstallCommand(
  namespace: string,
  slug: string,
  baseUrl: string,
  version?: string,
  scope: InstallScope = 'user',
): string {
  if (version && !isPortableSkillVersion(version)) {
    return ''
  }
  const coordinate = buildSkillhubCoordinate(namespace, slug)
  const versionArg = version ? ` --version ${version}` : ''
  return `npx --registry ${getCliNpmRegistry()} ${SKILLHUB_CLI_PACKAGE}@latest install ${coordinate}${versionArg} --scope ${scope} --registry ${baseUrl}`
}

export function buildSkillhubUpgradeCommand(
  namespace: string,
  slug: string,
  baseUrl: string,
): string {
  const coordinate = buildSkillhubCoordinate(namespace, slug)
  return `npx --registry ${getCliNpmRegistry()} ${SKILLHUB_CLI_PACKAGE}@latest upgrade ${coordinate} --registry ${baseUrl}`
}

export function buildSkillhubRemoveCommand(
  namespace: string,
  slug: string,
  baseUrl: string,
): string {
  const coordinate = buildSkillhubCoordinate(namespace, slug)
  return `npx --registry ${getCliNpmRegistry()} ${SKILLHUB_CLI_PACKAGE}@latest remove ${coordinate} --all --registry ${baseUrl}`
}

interface CommandBlockProps {
  command: string
}

function CommandBlock({ command }: CommandBlockProps) {
  const { t } = useTranslation()
  const [copied, copy] = useCopyToClipboard()

  const handleCopy = async () => {
    try {
      await copy(command)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/50">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        title={copied ? t('copyButton.copied') : t('copyButton.copy')}
        aria-label={copied ? t('copyButton.copied') : t('copyButton.copy')}
        className="absolute right-2 top-2 z-10 h-8 w-8 rounded-md bg-background/80 backdrop-blur hover:bg-background"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <pre className="px-4 py-3 pr-14 whitespace-pre-wrap break-all">
        <code className="font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-all sm:text-sm">
          {command}
        </code>
      </pre>
    </div>
  )
}

export function InstallCommand({ namespace, slug, version }: InstallCommandProps) {
  const { t } = useTranslation()
  const baseUrl = useMemo(() => getBaseUrl(), [])
  const [scope, setScope] = useState<InstallScope>('user')
  const skillhubCommand = useMemo(
    () => buildSkillhubInstallCommand(namespace, slug, baseUrl, version, scope),
    [baseUrl, namespace, slug, version, scope],
  )
  const upgradeCommand = useMemo(
    () => buildSkillhubUpgradeCommand(namespace, slug, baseUrl),
    [baseUrl, namespace, slug],
  )
  const removeCommand = useMemo(
    () => buildSkillhubRemoveCommand(namespace, slug, baseUrl),
    [baseUrl, namespace, slug],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2" role="radiogroup" aria-label={t('skillDetail.installScopeLabel')}>
        <span className="text-xs text-muted-foreground">{t('skillDetail.installScopeLabel')}</span>
        {(['user', 'project'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={scope === value}
            onClick={() => setScope(value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              scope === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted/70',
            )}
          >
            {t(`skillDetail.installScope.${value}`)}
          </button>
        ))}
      </div>
      {skillhubCommand
        ? <CommandBlock command={skillhubCommand} />
        : <p role="alert" className="text-sm text-destructive">{t('skillDetail.installCommandUnsafeVersion')}</p>}

      <div className="space-y-2 border-t border-border/60 pt-3">
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t('skillDetail.upgradeCommandLabel')}</span>
          <CommandBlock command={upgradeCommand} />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">{t('skillDetail.removeCommandLabel')}</span>
          <CommandBlock command={removeCommand} />
        </div>
      </div>
    </div>
  )
}
