import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore'

/* Text-only nav cards, matching the WEAVE layout -- no icons. The only
   adornment is the shortfall badge on Stores, which is a real count derived
   from the loaded inventory data (SKUs flagged Replenish or Low). */
function NavItem({ to, label, badge, active }: {
  to: string; label: string; badge?: number; active?: boolean
}) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link ${active ?? isActive ? 'active' : ''}`}>
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="text-[10px] leading-none bg-red text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold num flex-shrink-0">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const stores = useAppStore((s) => s.stores)
  const storeOrder = useAppStore((s) => s.storeOrder)
  const currentStore = useAppStore((s) => s.currentStore)
  const location = useLocation()

  const shortfallCount = storeOrder.reduce((acc, id) => {
    const store = stores[id]
    return acc + (store ? store.skus.filter((k) => k.st === 'replenish' || k.st === 'low').length : 0)
  }, 0)

  return (
    <aside className="w-[210px] flex-shrink-0 flex flex-col h-full bg-sidebar">
      {/* Brand */}
      <div className="px-4 pt-5 pb-6">
        <div className="border border-dashed border-white/40 rounded px-3 py-2 inline-block">
          <div className="text-[17px] font-extrabold text-white leading-none tracking-tight">WEAVE</div>
        </div>
        <div className="text-[10.5px] font-semibold text-cyan-bright mt-2">Enterprise Planning</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-2">
        <NavItem to="/cockpit" label="Enterprise Cockpit" />
        <NavItem to="/demand" label="Demand Planning" />
        <NavItem to="/inventory" label="Inventory Management" />
        <NavItem to="/insights" label="Decision Intelligence" />
        <NavItem
          to={currentStore ? `/stores/${currentStore}` : '/cockpit'}
          label="Stores"
          badge={shortfallCount}
          active={location.pathname.startsWith('/stores/')}
        />
        <NavItem to="/agents" label="AI Agent" />
      </nav>

      <div className="px-4 py-5 mt-2">
        <div className="border-t border-white/15 pt-4 text-[10px] text-white/35 leading-relaxed">
          {storeOrder.length} location{storeOrder.length === 1 ? '' : 's'} · 1 DC
        </div>
      </div>
    </aside>
  )
}
