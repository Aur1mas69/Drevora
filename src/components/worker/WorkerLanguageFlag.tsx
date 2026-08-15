import {
  WORKER_LANGUAGE_FLAG_CODES,
  type WorkerLanguage,
} from '@/i18n/languages'
import { cn } from '@/lib/utils'
import gbFlag from '@/assets/flags/gb.svg'
import ltFlag from '@/assets/flags/lt.svg'
import plFlag from '@/assets/flags/pl.svg'
import roFlag from '@/assets/flags/ro.svg'
import ruFlag from '@/assets/flags/ru.svg'

const WORKER_LANGUAGE_FLAG_SRC = {
  gb: gbFlag,
  lt: ltFlag,
  pl: plFlag,
  ro: roFlag,
  ru: ruFlag,
} as const

export function WorkerLanguageFlag({
  language,
  className,
}: {
  language: WorkerLanguage
  className?: string
}) {
  const code = WORKER_LANGUAGE_FLAG_CODES[language]
  return (
    <img
      src={WORKER_LANGUAGE_FLAG_SRC[code]}
      alt=""
      width={24}
      height={16}
      draggable={false}
      aria-hidden
      className={cn(
        'h-4 w-6 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10',
        className,
      )}
    />
  )
}
