import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../App.vue')
  },
  {
    path: '/share',
    name: 'Share',
    component: () => import('../views/ShareView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router