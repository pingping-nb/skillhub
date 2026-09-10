import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import fr from './locales/fr.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'
import zhTW from './locales/zh-TW.json'

/**
 * Initializes i18next for the browser app. Language preference is restored from
 * localStorage first so the UI stays stable across reloads before falling back
 * to the browser locale.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ru: { translation: ru },
      zh: { translation: zh },
      'zh-TW': { translation: zhTW },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
