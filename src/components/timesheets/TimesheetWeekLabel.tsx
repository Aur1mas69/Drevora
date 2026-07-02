type TimesheetWeekLabelProps = {
  weekTitle: string
  weekRangeLabel: string
  titleClassName?: string
  rangeClassName?: string
  layout?: 'stack' | 'inline'
}

export function TimesheetWeekLabel({
  weekTitle,
  weekRangeLabel,
  titleClassName = 'font-semibold',
  rangeClassName = 'text-slate-500 dark:text-slate-400',
  layout = 'stack',
}: TimesheetWeekLabelProps) {
  if (layout === 'inline') {
    return (
      <span>
        <span className={titleClassName}>{weekTitle}</span>
        <span className={` ${rangeClassName}`}> · {weekRangeLabel}</span>
      </span>
    )
  }

  return (
    <>
      <p className={titleClassName}>{weekTitle}</p>
      <p className={rangeClassName}>{weekRangeLabel}</p>
    </>
  )
}
