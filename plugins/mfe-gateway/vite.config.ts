import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Allow all hosts (like crm-frontend.proteus.local)
    // Cho phép import source of truth ở plugins/<code>/frontend/src (ngoài root gateway)
    fs: { allow: ['..', '../..'] },
  },
})
