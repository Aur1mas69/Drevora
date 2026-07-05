import { useMemo, useState } from 'react'
import { getWorkerInitials } from '@/lib/workerAvatarUtils'
import { getWorkerAvatarPublicUrl } from '@/services/workerAvatarStorageService'
import { cn } from '@/lib/utils'

const sizeClassMap = {
  sm: 'size-11 text-sm rounded-full ring-2 ring-[#BFE3F5]/80',
  md: 'size-16 text-lg rounded-2xl ring-2 ring-[#BFE3F5]/70',
  lg: 'size-20 text-xl rounded-2xl ring-2 ring-[#BFE3F5]/70 sm:size-24 sm:text-2xl',
} as const

type WorkerAvatarProps = {
  firstName: string
  lastName: string
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
  const [imageFailed, setImageFailed] = useState(false)
  const initials = getWorkerInitials(firstName, lastName)

  const imageUrl = useMemo(() => {
    if (!avatarUrl?.trim() || imageFailed) return null
    return getWorkerAvatarPublicUrl(avatarUrl)
  }, [avatarUrl, imageFailed])

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
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  )
}
