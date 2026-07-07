import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the built app works from a GitHub Pages project subpath
// (https://<user>.github.io/<repo>/) without hardcoding the repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
})
