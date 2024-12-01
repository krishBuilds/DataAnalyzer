import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import axios from 'axios'
import { defineCustomElements } from '@revolist/revogrid/loader'

// Configure axios defaults
axios.defaults.baseURL = process.env.VUE_APP_API_URL || 'http://localhost:3000'
defineCustomElements();

const app = createApp(App)

app.use(router)
app.use(store)

app.mount('#app')
