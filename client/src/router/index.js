import { createRouter, createWebHistory } from 'vue-router'
import ChatAnalysisBoard from '@/components/ChatAnalysisBoard.vue'
import AnalysisDashboard from '@/components/AnalysisDashboard.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: ChatAnalysisBoard,
    meta: { keepAlive: true }
  },
  {
    path: '/analysis',
    name: 'AnalysisDashboard',
    component: AnalysisDashboard,
    meta: { keepAlive: true }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  }
})

export default router 