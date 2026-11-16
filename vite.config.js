import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import generateDesignHandler from './api/generate-design.js'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function localApiPlugin(mode) {
  const serverEnv = loadEnv(mode, process.cwd(), '')
  for (const key of ['OPENAI_API_KEY', 'OPENAI_IMAGE_MODEL', 'OPENAI_IMAGE_QUALITY']) {
    if (serverEnv[key]) process.env[key] = serverEnv[key]
  }

  return {
    name: 'connect767-local-api',
    configureServer(server) {
      server.middlewares.use('/api/generate-design', async (req, res) => {
        if (req.method === 'POST') {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          try {
            req.body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid JSON request.' }))
            return
          }
        }
        res.status = (status) => {
          res.statusCode = status
          return res
        }
        res.json = (payload) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        }
        await generateDesignHandler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  root: projectRoot,
  plugins: [react(), tailwindcss(), localApiPlugin(mode)],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: fileURLToPath(new URL('./src/test/setup.js', import.meta.url)),
  },
}))
