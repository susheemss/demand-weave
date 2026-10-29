import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import StoreSummaryCard from '../components/store/StoreSummaryCard'
import SkuTable from '../components/tables/SkuTable'
import AITag from '../components/ai/AITag'
import PendingNote from '../components/ui/PendingNote'
import { useAppStore } from '../store/useAppStore'
import { useStoreView } from '../hooks/useStoreView'

export default function StoreDetail() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const storeOrder = useAppStore((s) => s.storeOrder)
  const currentStore = useAppStore((s) => s.currentStore)
  const setStore = useAppStore((s) => s.setStore)
  const currentSkuFilter = useAppStore((s) => s.currentSkuFilter)
  const currentCustomerFilter = useAppStore((s) => s.currentCustomerFilter)

  const id = storeId && storeOrder.includes(storeId) ? storeId : currentStore

  useEffect(() => {
    if (id && id !== currentStore) setStore(id)
  }, [id, currentStore, setStore])

  const store = useStoreView(id)

  if (!store) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <PendingNote>No data loaded yet. Use Refresh in the top bar to load it.</PendingNote>
      </div>
    )
  }

  const flagged = store.skus.filter((s) => s.st === 'replenish' || s.st === 'low')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-[11.5px] text-ink4">
        <button onClick={() => navigate('/cockpit')} className="hover:text-cyan-dark font-medium">Enterprise Cockpit</button>
        <ChevronRight size={12} />
        <span className="text-ink2 font-semibold">{store.name} · SKU replenishment detail</span>
      </div>

      <div className="grid grid-cols-[264px_1fr] gap-4 items-start">
        <StoreSummaryCard store={store} customerFilter={currentCustomerFilter} />

        <div className="space-y-3">
          <SkuTable skus={store.skus} filter={currentSkuFilter} />

          <div className="rounded-lg border border-dashed border-purple/45 bg-purple-light/25 px-4 py-3 flex items-center gap-3 flex-wrap">
            <AITag />
            {store.hasInv ? (
              <span className="text-[12px] text-ink2 flex-1 min-w-[280px]">
                <span className="font-bold num">{flagged.length}</span> SKU{flagged.length === 1 ? '' : 's'} flagged for
                replenishment at {store.name}
                <span className="text-ink4 mx-1.5">·</span>
                lane consolidation and truck fill need freight-cost data, not available yet
              </span>
            ) : (
              <span className="text-[12px] text-ink4 flex-1 min-w-[280px]">
                Replenishment flags need inventory data for this store, not available yet.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
