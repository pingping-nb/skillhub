import type { NotificationItem } from '@/api/types'

export type NotificationDisplay = {
  title: string
  description: string
}

type NotificationBody = {
  skillName?: string
  version?: string
}

function parseBody(bodyJson?: string): NotificationBody {
  if (!bodyJson) {
    return {}
  }
  try {
    const parsed = JSON.parse(bodyJson)
    return typeof parsed === 'object' && parsed !== null ? parsed as NotificationBody : {}
  } catch {
    return {}
  }
}

function isChinese(language: string) {
  return language.toLowerCase().startsWith('zh')
}

export function resolveNotificationDisplay(item: NotificationItem, language: string): NotificationDisplay {
  const zh = isChinese(language)
  const body = parseBody(item.bodyJson)
  const skillName = body.skillName ?? ''
  const version = body.version ?? ''
  const versionSuffix = version ? (zh ? `（${version}）` : ` (${version})`) : ''

  switch (item.eventType) {
    case 'REVIEW_SUBMITTED':
      return {
        title: zh ? '技能稽核提交' : 'Review submitted',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 已提交稽核。` : `${skillName}${versionSuffix} was submitted for review.`) : '',
      }
    case 'REVIEW_APPROVED':
      return {
        title: zh ? '技能稽核透過' : 'Review approved',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 已稽核透過。` : `${skillName}${versionSuffix} was approved.`) : '',
      }
    case 'REVIEW_REJECTED':
      return {
        title: zh ? '技能稽核駁回' : 'Review rejected',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 稽核未透過。` : `${skillName}${versionSuffix} was rejected.`) : '',
      }
    case 'PROMOTION_SUBMITTED':
      return {
        title: zh ? '技能推廣提交' : 'Promotion submitted',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 已提交推廣。` : `${skillName}${versionSuffix} was submitted for promotion.`) : '',
      }
    case 'PROMOTION_APPROVED':
      return {
        title: zh ? '技能推廣透過' : 'Promotion approved',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 推廣已透過。` : `${skillName}${versionSuffix} promotion was approved.`) : '',
      }
    case 'PROMOTION_REJECTED':
      return {
        title: zh ? '技能推廣駁回' : 'Promotion rejected',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 推廣未透過。` : `${skillName}${versionSuffix} promotion was rejected.`) : '',
      }
    case 'REPORT_SUBMITTED':
      return {
        title: zh ? '技能舉報提交' : 'Report submitted',
        description: skillName ? (zh ? `${skillName} 收到新的舉報。` : `${skillName} received a new report.`) : '',
      }
    case 'REPORT_RESOLVED':
      return {
        title: zh ? '技能舉報已處理' : 'Report resolved',
        description: skillName ? (zh ? `${skillName} 的舉報已處理。` : `${skillName} report has been resolved.`) : '',
      }
    case 'SKILL_PUBLISHED':
      return {
        title: zh ? '技能發布成功' : 'Skill published',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 已發布。` : `${skillName}${versionSuffix} was published.`) : '',
      }
    case 'SUBSCRIPTION_NEW_VERSION':
      return {
        title: zh ? '訂閱技能更新' : 'Subscribed skill updated',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 發布了新版本。` : `${skillName}${versionSuffix} published a new version.`) : '',
      }
    case 'SUBSCRIPTION_VERSION_YANKED':
      return {
        title: zh ? '訂閱技能版本撤回' : 'Subscribed skill version yanked',
        description: skillName ? (zh ? `${skillName}${versionSuffix} 版本已撤回。` : `${skillName}${versionSuffix} version was yanked.`) : '',
      }
    default:
      return {
        title: item.title,
        description: '',
      }
  }
}
