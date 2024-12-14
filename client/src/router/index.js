import { createRouter, createWebHistory } from 'vue-router'
import ChatAnalysisBoard from '@/components/ChatAnalysisBoard.vue'
import AnalysisDashboard from '@/components/AnalysisDashboard.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: ChatAnalysisBoard
  },
  {
    path: '/analysis',
    name: 'AnalysisDashboard',
    component: AnalysisDashboard
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router 