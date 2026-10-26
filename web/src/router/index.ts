import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/sales-orders' },
    {
      path: '/sales-orders',
      name: 'sales-orders',
      component: () => import('@/views/SalesOrdersToPlanView.vue'),
    },
    {
      path: '/transport-orders',
      name: 'transport-orders',
      component: () => import('@/views/TransportOrdersView.vue'),
    },
    {
      path: '/transport-orders/:no',
      name: 'transport-order',
      component: () => import('@/views/TransportOrderDetailView.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', redirect: '/sales-orders' },
  ],
})

export default router
