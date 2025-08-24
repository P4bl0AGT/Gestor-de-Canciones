import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Gestor-de-Canciones/', // GH Pages base (repo name)
})
