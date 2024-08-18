import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import 'element-plus/dist/index.css'

createApp(App).mount('#app')
declare global {
  interface Window {
    _AMapSecurityConfig: {
      securityJsCode: string,
    };
  }
}