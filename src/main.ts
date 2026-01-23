// Array.at polyfill
if (!(Array.prototype as any).at) {
  (Array.prototype as any).at = function(n: number) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    if (n < 0 || n >= this.length) return undefined;
    return this[n];
  };
}

import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')
