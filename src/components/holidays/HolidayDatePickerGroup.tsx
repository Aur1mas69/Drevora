import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type HolidayDatePickerGroupContextValue = {
  openId: string | null
  setOpenId: (id: string | null) => void
}

const HolidayDatePickerGroupContext = createContext<HolidayDatePickerGroupContextValue | null>(
  null,
)

export function HolidayDatePickerGroup({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const value = useMemo(() => ({ openId, setOpenId }), [openId])

  return (
    <HolidayDatePickerGroupContext.Provider value={value}>
      {children}
    </HolidayDatePickerGroupContext.Provider>
  )
}

export function useHolidayDatePickerGroup() {
  return useContext(HolidayDatePickerGroupContext)
}
