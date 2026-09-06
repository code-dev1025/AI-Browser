import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const shared = resolve(__dirname, 'src/shared')

// VS Code's extension host sets ELECTRON_RUN_AS_NODE=1, and any terminal or
// task it spawns inherits it. With that set, our Electron binary boots as plain
// Node, so require('electron') returns the path string instead of the API and
// the app dies on the first ipcMain access. Clear it before we launch.
delete process.env['ELECTRON_RUN_AS_NODE']

/**
 * The renderers ship a strict CSP: the shell displays text extracted from
 * arbitrary web pages, so it must not be able to fetch or execute anything.
 * Dev needs two holes that production must not have — React Refresh injects an
 * inline module script, and HMR opens a websocket. `ctx.server` is defined only
 * when a dev server is serving the page, which makes it the reliable signal.
 */
function cspPlugin(): Plugin {
  return {
    name: 'ai-browser-csp',
    transformIndexHtml(html, ctx) {
      const dev = ctx.server !== undefined
      return html
        .replace('__CSP_SCRIPT__', dev ? " 'unsafe-inline'" : '')
        .replace('__CSP_CONNECT__', dev ? ' ws://127.0.0.1:5173 http://127.0.0.1:5173' : '')
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': shared }
    },
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },

  // Two preloads. `shell` is the wide API for our own React UI.
  // `content` is the narrow API that runs beside untrusted web pages.
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': shared }
    },
    build: {
      rollupOptions: {
        input: {
          shell: resolve(__dirname, 'src/preload/shell.ts'),
          content: resolve(__dirname, 'src/preload/content.ts')
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js'
        }
      }
    }
  },

  // Two renderer entry points (see L3 in the blueprint):
  //   shell/   — the browser chrome, painted *under* the page views
  //   overlay/ — a transparent always-on-top view for popups that must
  //              appear over the page (command palette, find bar, suggestions)
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // Bind IPv4 explicitly. Left to itself Vite listens on [::1] only, while
    // Electron resolves `localhost` to 127.0.0.1 first and gets a refused
    // connection on every Windows machine.
    server: { host: '127.0.0.1', strictPort: true, port: 5173 },
    plugins: [react(), cspPlugin()],
    resolve: {
      alias: {
        '@shared': shared,
        '@renderer': resolve(__dirname, 'src/renderer')
      }
    },
    build: {
      rollupOptions: {
        input: {
          shell: resolve(__dirname, 'src/renderer/shell/index.html'),
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html')
        }
      }
    }
  }
})
