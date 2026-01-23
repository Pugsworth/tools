import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    (monacoEditorPlugin as any).default({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'html', 'css']
    })
  ],
})
