import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Cockpit from './pages/Cockpit'
import DemandPlanning from './pages/DemandPlanning'
import InventoryManagement from './pages/InventoryManagement'
import DecisionIntelligence from './pages/DecisionIntelligence'
import StoreDetail from './pages/StoreDetail'
import Agents from './pages/Agents'
import ChatAssistant from './components/ai/ChatAssistant'
import DrillDownPanel from './components/drilldown/DrillDownPanel'
import { useAppStore } from './store/useAppStore'

function StatusBar() {
  const storeOrder = useAppStore((s) => s.storeOrder)
  const stores = useAppStore((s) => s.stores)
  const refresh = useAppStore((s) => s.refresh)
  const skuCount = storeOrder.reduce((a, id) => a + (stores[id]?.skus.length ?? 0), 0)

  return (
    <footer className="statusbar">
      <span className="inline-flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${refresh.status === 'success' ? 'bg-green' : refresh.status === 'error' ? 'bg-red' : 'bg-ink5'}`} />
        {refresh.status === 'success' ? 'Connected · live source files' : refresh.status === 'loading' ? 'Refreshing…' : refresh.status === 'error' ? 'Refresh failed' : 'Not connected'}
      </span>
      <span className="ml-auto hidden sm:inline">{storeOrder.length} store{storeOrder.length === 1 ? '' : 's'} · {skuCount} SKU positions · 1 DC</span>
    </footer>
  )
}

export default function App() {
  const refreshFromSource = useAppStore((s) => s.refreshFromSource)

  useEffect(() => {
    refreshFromSource()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-5 bg-bg">
            <Routes>
              <Route path="/" element={<Navigate to="/cockpit" replace />} />
              <Route path="/cockpit" element={<Cockpit />} />
              <Route path="/demand" element={<DemandPlanning />} />
              <Route path="/inventory" element={<InventoryManagement />} />
              <Route path="/insights" element={<DecisionIntelligence />} />
              <Route path="/stores/:storeId" element={<StoreDetail />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="*" element={<Navigate to="/cockpit" replace />} />
            </Routes>
          </main>
          <StatusBar />
        </div>
        <ChatAssistant />
        <DrillDownPanel />
      </div>
    </HashRouter>
  )
}
