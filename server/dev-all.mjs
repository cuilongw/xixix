/**
 * 一条命令同时启动「模拟后端(8000)」和「Vite 前端(5000)」
 * 用法：npm run dev:demo
 * 说明：真实 Django 后端可用时，直接 npm run dev 即可，不需要它。
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const children = []

function run(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  child.on('exit', (code) => {
    console.log(`[dev:demo] ${name} 退出，code=${code}`)
    shutdown()
  })
  children.push(child)
  return child
}

function shutdown() {
  for (const c of children) {
    if (!c.killed) {
      try { c.kill() } catch (e) { /* ignore */ }
    }
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

run('mock-api', [path.join(__dirname, 'mock-api.mjs')])
run('vite', [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host'])
