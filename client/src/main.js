import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import axios from 'axios'

// Configure axios defaults
axios.defaults.baseURL = process.env.NODE_ENV === 'production' 
  ? 'http://localhost:3000' 
  : process.env.VUE_APP_API_URL || 'http://localhost:3000'

const app = createApp(App)

app.use(router)
app.use(store)
app.mount('#app')
