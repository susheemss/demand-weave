import type { ReactNode } from 'react'
import type { DeltaClass } from '../../types'
import Sparkline from '../ui/Sparkline'

interface KpiTileProps {
  label: string
  value: string
  delta?: string
  deltaClass?: DeltaClass
  highlight?: boolean
  icon?: ReactNode
  sub?: string
  spark?: number[]
  sparkColor?: string
}

export default function KpiTile({
  label, value, delta, deltaClass = 'delta-neu', highlight, icon, sub, spark, sparkColor,
}: KpiTileProps) {
  return (
    /* min-height keeps a tile whose value hasn't been produced yet the same
       size as its neighbours, so a band of mostly-empty tiles still reads
       as a grid rather than a ragged row. */
    <div className={`kpi-tile min-h-[70px] ${highlight ? 'kpi-tile-highlight' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`kpi-label ${highlight ? 'text-blue-dark' : ''}`}>{label}</span>
        {icon && <span className={highlight ? 'text-blue' : 'text-ink5'}>{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        {/* No value at all when the source file hasn't produced one -- the
            KPI name alone, never a zero or a placeholder glyph. */}
        {value && <div className={`kpi-value ${highlight ? 'text-blue-dark' : ''}`}>{value}</div>}
        {spark && spark.length > 1 && (
          <div className="pb-1">
            <Sparkline data={spark} color={sparkColor ?? (highlight ? '#2E6BE6' : '#8B95A5')} />
          </div>
        )}
      </div>
      {(delta || sub) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {delta && <span className={deltaClass}>{delta}</span>}
          {sub && <span className="text-[11px] text-ink5">{sub}</span>}
        </div>
      )}
    </div>
  )
}
