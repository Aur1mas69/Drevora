import { useEffect, useState } from 'react'
import { isExternalAvatarUrl } from '@/lib/workerAvatarStorage'
import { getWorkerInitials } from '@/lib/workerAvatarUtils'
import { getWorkerAvatarSignedUrl } from '@/services/workerAvatarStorageService'
import { cn } from '@/lib/utils'

const sizeClassMap = {
  sm: 'size-11 text-sm rounded-full ring-2 ring-[#BFE3F5]/80',
  md: 'size-16 text-lg rounded-2xl ring-2 ring-[#BFE3F5]/70',
  lg: 'size-20 text-xl rounded-2xl ring-2 ring-[#BFE3F5]/70 sm:size-24 sm:text-2xl',
} as const

type WorkerAvatarProps = {
  firstName: string
  lastName: string
  /** Stored object path, external URL, or blob:/data: preview — never a persisted signed URL. */
  avatarUrl?: string | null
  size?: keyof typeof sizeClassMap
  className?: string
}

export function WorkerAvatar({
  firstName,
  lastName,
  avatarUrl,
  size = 'md',
  className,
}: WorkerAvatarProps) {
  const sourceKey = avatarUrl?.trim() ?? ''
  const initials = getWorkerInitials(firstName, lastName)

  const [imageFailedFor, setImageFailedFor] = useState<string | null>(null)
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [signedFor, setSignedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!sourceKey || isExternalAvatarUrl(sourceKey)) {
      return
    }

    let cancelled = false

    void getWorkerAvatarSignedUrl(sourceKey).then((url) => {
      if (!cancelled) {
        setSignedUrl(url)
        setSignedFor(sourceKey)
      }
    })

    return () => {
      cancelled = true
    }
  }, [sourceKey])

  const syncExternalUrl =
    sourceKey && isExternalAvatarUrl(sourceKey) ? sourceKey : null
  const asyncSignedUrl = signedFor === sourceKey ? signedUrl : null
  const resolvedUrl = syncExternalUrl ?? asyncSignedUrl
  const imageFailed = imageFailedFor === sourceKey && sourceKey !== ''
  const imageUrl = imageFailed ? null : resolvedUrl

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-[#E8F3FE] to-[#D3E9FC] font-bold text-[#0B68BE] shadow-sm',
        sizeClassMap[size],
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailedFor(sourceKey)}
        />
      ) : (
        initials
      )}
    </div>
  )
}
