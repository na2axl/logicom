import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SalesOrderResource } from '@/api/resources'
import { usePlanningStore } from '../planning'

const order = (no: string, totalWeightKg: number): SalesOrderResource => ({
  no,
  customerNo: 'C0001',
  customerName: 'Client',
  deliveryCity: 'Douala',
  totalWeightKg,
  status: 'TO_PLAN',
})

describe('planning store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('keeps the selection across pages and sums its weight exactly', () => {
    const store = usePlanningStore()
    store.toggle(order('SO-1', 0.1), true)
    store.setPage(2)
    store.toggle(order('SO-2', 0.2), true)
    store.toggle(order('SO-2', 0.2), true) // selecting twice does not duplicate

    expect(store.selectedNos).toEqual(['SO-1', 'SO-2'])
    expect(store.selectedWeightKg).toBe(0.3)

    store.toggle(order('SO-1', 0.1), false)
    expect(store.selectedNos).toEqual(['SO-2'])
  })

  it('goes back to the first page when the city filter changes', () => {
    const store = usePlanningStore()
    store.setPage(3)
    store.setCity('Kribi')
    expect(store.params).toEqual({ city: 'Kribi', page: 1, pageSize: 10 })
  })

  it('goes back to the first page when the page size changes', () => {
    const store = usePlanningStore()
    store.setPage(3)
    store.setPage(3, 20)
    expect(store.params).toMatchObject({ page: 1, pageSize: 20 })
  })

  it('drops the sales orders the API refused from the selection', () => {
    const store = usePlanningStore()
    store.toggle(order('SO-1', 100), true)
    store.toggle(order('SO-2', 50), true)
    store.toggle(order('SO-3', 25), true)

    store.deselect(['SO-1', 'SO-3'])

    expect(store.selectedNos).toEqual(['SO-2'])
    expect(store.selectedWeightKg).toBe(50)
  })

  it('moves back to the last page when rows disappear', () => {
    const store = usePlanningStore()
    store.setPage(3)

    store.clampPage(25) // 3 pages of 10: still valid
    expect(store.page).toBe(3)

    store.clampPage(15)
    expect(store.page).toBe(2)

    store.clampPage(0)
    expect(store.page).toBe(1)
  })
})
