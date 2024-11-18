import { createRouter, createWebHistory } from 'vue-router'
import DataTable from '../components/DataTable.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: DataTable
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router 