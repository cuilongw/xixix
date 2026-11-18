/**
 * 本地模拟后端（零依赖，仅用于演示 / 联调前端）
 *
 * 说明：
 *  - 真实后端是 Django，监听 8000 端口；前端 src/utils/request.js 里 baseURL 写死了
 *    http://localhost:8000/ ，所以这个 mock 也跑在 8000，前端代码无需任何改动。
 *  - 数据全部在内存里，重启即恢复；图片复用 src/assets 里已有的素材，不联网。
 *  - 启动：npm run mock        仅启动 mock
 *          npm run dev:demo    同时启动 mock + vite（一条命令看效果）
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = Number(process.env.MOCK_PORT || 8000)
const HOST = 'http://localhost:' + PORT

/* ------------------------------------------------------------------ 静态图片 */
// 复用项目里已有素材，避免 mock 依赖外网图片
const IMAGE_FILES = [
  { url: 'w1.png', file: 'src/assets/images/首页.png' },
  { url: 'w2.jpeg', file: 'src/assets/images/个人中心.jpeg' },
  { url: 'w3.jpeg', file: 'src/assets/images/后台管理.jpeg' },
  { url: 'w4.jpeg', file: 'src/assets/images/人员管理.jpeg' },
  { url: 'w5.jpeg', file: 'src/assets/images/上传壁纸.jpeg' },
  { url: 'w6.png', file: 'src/assets/static/1.png' },
]
const imageUrl = (i) => `${HOST}/media/wallpapers/${IMAGE_FILES[i % IMAGE_FILES.length].url}`

/* ------------------------------------------------------------------ 模拟数据 */
const CATEGORIES = [
  { id: 1, name: '风景', resolution: '1920x1080', media_type: 'computer', tags: '风景,自然,4K' },
  { id: 2, name: '动漫', resolution: '2560x1440', media_type: 'computer', tags: '动漫,插画,二次元' },
  { id: 3, name: '城市', resolution: '3840x2160', media_type: 'computer', tags: '城市,夜景,赛博' },
  { id: 4, name: '极简', resolution: '1080x1920', media_type: 'mobile', tags: '极简,纯色,简约' },
  { id: 5, name: 'ins风', resolution: '1170x2532', media_type: 'mobile', tags: 'ins风,清新,治愈' },
  { id: 6, name: '可爱', resolution: '512x512', media_type: 'avatar', tags: '可爱,萌宠,卡通' },
  { id: 7, name: '星空', resolution: '1080x1920', media_type: 'mobile', tags: '星空,暗色,宇宙' },
]

const NAV = [
  { id: 1, title: '电脑壁纸', path: '/', icon: 'House' },
  { id: 2, title: '手机壁纸', path: '/phone', icon: 'Iphone' },
  { id: 3, title: '头像', path: '/avatar', icon: 'User' },
  { id: 4, title: '个人中心', path: '/my', icon: 'Setting' },
]

const TITLES = {
  computer: ['雪山之巅', '赛博都市', '晨雾森林', '极简几何', '落日海岸', '深夜书房'],
  mobile: ['奶油白', '蓝调时刻', '碎花', '格子', '云朵', '渐变黄昏'],
  avatar: ['小猫', '机器人', '宇航员', '花朵', '像素风', '简约线条'],
}
const TAG_POOL = ['风景', '插画', '暗色', '清新', '4K', '简约', '治愈', '赛博']

let nextId = 1
const WALLPAPERS = []
for (const media of ['computer', 'mobile', 'avatar']) {
  TITLES[media].forEach((title, i) => {
    const id = nextId++
    const cat = CATEGORIES.filter((c) => c.media_type === media)[i % 3] || CATEGORIES[0]
    WALLPAPERS.push({
      id,
      title,
      description: `${title} - ${media} 壁纸`,
      image: imageUrl(id),
      image_url: imageUrl(id),
      media_type: media,
      category: cat.name,
      resolution: cat.resolution,
      tags: JSON.stringify([TAG_POOL[i % TAG_POOL.length], TAG_POOL[(i + 3) % TAG_POOL.length]]),
      downloads: 10 + i * 7,
      status: i === 0 && media !== 'computer' ? 'pending' : 'approved',
      uploader: 'admin',
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
    })
  })
}

const USERS = [
  { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', banned: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 2, username: 'test01', email: 'test01@example.com', role: 'user', banned: false, created_at: '2026-02-11T00:00:00Z' },
  { id: 3, username: 'badguy', email: 'bad@example.com', role: 'user', banned: true, created_at: '2026-03-05T00:00:00Z' },
]

const FAVORITES = new Set([1, 3, 7])

/* ------------------------------------------------------------------ 工具函数 */
const json = (res, body, status = 200) => {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  })
  res.end(data)
}

const paginate = (list, url) => {
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') || url.searchParams.get('page_size') || 10))
  const start = (page - 1) * pageSize
  return {
    count: list.length,
    page,
    page_size: pageSize,
    total_pages: Math.ceil(list.length / pageSize) || 1,
    results: list.slice(start, start + pageSize),
  }
}

const norm = (p) => (p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p)

function matchWallpapers(url) {
  const media = (url.searchParams.get('media_type') || '').trim()
  const category = (url.searchParams.get('category') || '').trim()
  const resolution = (url.searchParams.get('resolution') || '').trim()
  const tags = (url.searchParams.get('tags') || '').trim()
  const title = (url.searchParams.get('title') || '').trim()
  return WALLPAPERS.filter((w) => {
    if (media && w.media_type !== media) return false
    if (category && w.category !== category) return false
    if (resolution && w.resolution !== resolution) return false
    if (title && !w.title.includes(title)) return false
    if (tags) {
      const list = JSON.parse(w.tags || '[]')
      if (!list.some((t) => t.includes(tags))) return false
    }
    return true
  })
}

/* ------------------------------------------------------------------ 路由 */
async function handle(req, res) {
  const url = new URL(req.url, HOST)
  const p = norm(url.pathname)
  const method = req.method.toUpperCase()

  // 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    })
    return res.end()
  }

  // 静态图片
  if (method === 'GET' && p.startsWith('/media/wallpapers/')) {
    const name = p.split('/').pop()
    const hit = IMAGE_FILES.find((f) => f.url === name)
    if (!hit) return json(res, { message: 'not found' }, 404)
    try {
      const buf = await readFile(path.join(ROOT, hit.file))
      const ext = path.extname(hit.file).toLowerCase()
      const type = ext === '.png' ? 'image/png' : 'image/jpeg'
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': buf.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      })
      return res.end(buf)
    } catch (e) {
      return json(res, { message: 'image missing' }, 404)
    }
  }

  if (method === 'GET' && p === '/health') return json(res, { ok: true, wallpapers: WALLPAPERS.length })

  /* ---------------- 分类 / 导航 ---------------- */
  if (method === 'GET' && p === '/title/navigation-bar') return json(res, NAV)
  if (method === 'GET' && p === '/title/category-list') return json(res, CATEGORIES)
  if (method === 'GET' && p === '/title/category-item') return json(res, CATEGORIES)

  let m
  if ((m = p.match(/^\/title\/category-item\/(\d+)$/))) {
    const item = CATEGORIES.find((c) => c.id === Number(m[1]))
    if (!item) return json(res, { message: '分类不存在' }, 404)
    if (method === 'GET') return json(res, item)
    if (method === 'PATCH' || method === 'PUT') {
      Object.assign(item, await readBody(req))
      return json(res, { code: 200, message: '更新成功', data: item })
    }
    if (method === 'DELETE') {
      CATEGORIES.splice(CATEGORIES.indexOf(item), 1)
      return json(res, { code: 200, message: '删除成功' })
    }
  }
  if (method === 'POST' && p === '/title/category-item') {
    const body = await readBody(req)
    const item = { id: Math.max(0, ...CATEGORIES.map((c) => c.id)) + 1, ...body }
    CATEGORIES.push(item)
    return json(res, { code: 200, message: '创建成功', data: item })
  }

  /* ---------------- 壁纸 ---------------- */
  if (method === 'GET' && p === '/wallpapers/wallpapers/page') {
    return json(res, paginate(matchWallpapers(url), url))
  }
  if (method === 'GET' && p === '/wallpapers/wallpapers/search') {
    const q = (url.searchParams.get('tags') || '').trim()
    const list = WALLPAPERS.filter(
      (w) => !q || w.title.includes(q) || (w.tags || '').includes(q)
    )
    return json(res, list)
  }
  if (method === 'GET' && p === '/wallpapers/wallpapers/pending') {
    const list = WALLPAPERS.filter((w) => w.status === 'pending')
    const page = paginate(list, url)
    page.results = page.results.map((w) => ({ ...w }))
    return json(res, page)
  }

  if ((m = p.match(/^\/wallpapers\/wallpapers\/(\d+)(?:\/(edit|review|delete))?$/))) {
    const id = Number(m[1])
    const action = m[2]
    const item = WALLPAPERS.find((w) => w.id === id)
    if (!item) return json(res, { message: '壁纸不存在' }, 404)
    if (method === 'GET' && !action) return json(res, item)
    if (method === 'PATCH' && action === 'edit') {
      Object.assign(item, await readBody(req))
      return json(res, { code: 200, message: '修改成功', data: item })
    }
    if (method === 'POST' && action === 'review') {
      const body = await readBody(req)
      const approved =
        body.approved !== undefined
          ? Boolean(body.approved)
          : body.status
            ? body.status === 'approved'
            : Boolean(body.pass)
      item.status = approved ? 'approved' : 'rejected'
      return json(res, { code: 200, message: '审核完成', data: item })
    }
    if (method === 'DELETE' && action === 'delete') {
      WALLPAPERS.splice(WALLPAPERS.indexOf(item), 1)
      return json(res, { code: 200, message: '删除成功' })
    }
  }

  if ((m = p.match(/^\/wallpapers\/wallpapers\/download\/(\d+)$/)) && method === 'POST') {
    const item = WALLPAPERS.find((w) => w.id === Number(m[1]))
    if (item) item.downloads = (item.downloads || 0) + 1
    return json(res, { code: 200, message: '下载已记录' })
  }
  if (method === 'POST' && p === '/wallpapers/bulk-upload') {
    const body = await readBody(req)
    const files = Array.isArray(body) ? body : body.files || []
    const created = files.map((f, i) => ({
      id: nextId++,
      title: f.title || `未命名-${i + 1}`,
      image: imageUrl(i),
      image_url: imageUrl(i),
      media_type: f.media_type || 'computer',
      tags: JSON.stringify(f.tags || []),
      status: 'pending',
    }))
    WALLPAPERS.push(...created)
    return json(res, { code: 200, message: '上传成功', data: created })
  }

  /* ---------------- 收藏 ---------------- */
  if ((m = p.match(/^\/wallpapers\/favorite\/(\d+)\/favorite$/))) {
    const id = Number(m[1])
    if (method === 'POST') {
      FAVORITES.add(id)
      return json(res, { code: 200, message: '收藏成功' })
    }
    if (method === 'DELETE') {
      FAVORITES.delete(id)
      return json(res, { code: 200, message: '已取消收藏' })
    }
    if (method === 'GET') return json(res, { code: 200, favorited: FAVORITES.has(id) })
  }
  if ((m = p.match(/^\/wallpapers\/favorites(?:\/(computer|mobile|avatar))?$/)) && method === 'GET') {
    const media = m[1]
    const list = WALLPAPERS.filter((w) => FAVORITES.has(w.id) && (!media || w.media_type === media)).map((w) => ({
      id: w.id,
      wallpaper_id: w.id,
      wallpaper: w,
    }))
    const page = paginate(list, url)
    return json(res, { ...page, pagination: { total: list.length, page: page.page, page_size: page.page_size } })
  }

  /* ---------------- 下载历史 ---------------- */
  if (method === 'GET' && p === '/wallpapers/download-history') {
    const media = url.searchParams.get('media_type') || ''
    const list = WALLPAPERS.slice(0, 6)
      .filter((w) => !media || w.media_type === media)
      .map((w, i) => ({ id: 100 + i, wallpaper: w, wallpaper_id: w.id, ...w, downloaded_at: new Date().toISOString() }))
    return json(res, paginate(list, url))
  }
  if ((m = p.match(/^\/wallpapers\/download-history\/(\d+)$/)) && method === 'DELETE') {
    return json(res, { code: 200, message: '已删除' })
  }

  /* ---------------- 用户 ---------------- */
  if (method === 'POST' && p === '/user/login') {
    const body = await readBody(req)
    const username = (body.username || '').trim()
    const password = String(body.password || '')
    if (!username || !password) return json(res, { code: 400, message: '请输入账号和密码' }, 400)
    const isAdmin = username.toLowerCase() === 'admin'
    return json(res, {
      code: 200,
      message: '登录成功',
      token: {
        access: 'mock-access-' + Date.now(),
        refresh: 'mock-refresh-' + Date.now(),
      },
      user: { id: isAdmin ? 1 : 99, username, role: isAdmin ? 'admin' : 'user' },
    })
  }
  if (method === 'POST' && p === '/user/register') {
    const body = await readBody(req)
    USERS.push({ id: USERS.length + 1, username: body.username, email: body.email, role: 'user', banned: false })
    return json(res, { code: 200, message: '注册成功' })
  }
  if (method === 'POST' && p === '/user/send-code') {
    return json(res, { code: 200, message: '验证码已发送（演示环境请随意填写 6 位数字）' })
  }
  if (method === 'POST' && p === '/user/password-reset') {
    return json(res, { code: 200, message: '密码已重置' })
  }
  if (method === 'GET' && p === '/user/users') {
    const page = paginate(USERS, url)
    return json(res, { data: page.results, results: page.results, pagination: { total_count: USERS.length, total: USERS.length, page: page.page, page_size: page.page_size }, count: USERS.length })
  }
  if ((m = p.match(/^\/user\/users\/(\d+)\/ban$/)) && method === 'POST') {
    const u = USERS.find((x) => x.id === Number(m[1]))
    const body = await readBody(req)
    if (u) u.banned = body.ban ?? true
    return json(res, { code: 200, message: '操作成功' })
  }
  if (method === 'GET' && p === '/user/history') {
    const list = WALLPAPERS.slice(0, 5).map((w, i) => ({ id: 200 + i, ...w, viewed_at: new Date().toISOString() }))
    return json(res, paginate(list, url))
  }
  if (method === 'GET' && p === '/user/notifications') {
    const list = [
      { id: 1, title: '欢迎使用壁纸站', content: '这是一条演示通知，来自本地 mock 后端。', is_read: false, created_at: new Date().toISOString() },
      { id: 2, title: '你的壁纸已通过审核', content: '「雪山之巅」已上线。', is_read: true, created_at: new Date().toISOString() },
    ]
    return json(res, { results: list, total: list.length, count: list.length, unread: 1 })
  }
  if ((m = p.match(/^\/user\/notifications\/(\d+|all)\/read$/)) && method === 'POST') {
    return json(res, { code: 200, message: '已读' })
  }

  // 未覆盖的接口统一返回空列表，避免前端报 404 弹错
  console.warn('[mock] 未实现的路由:', method, p)
  return json(res, { code: 200, results: [], count: 0, data: [] })
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('[mock] 处理请求出错:', e)
    json(res, { message: String(e && e.message) }, 500)
  })
})
server.listen(PORT, () => {
  console.log(`[mock] 模拟后端已启动: ${HOST}  (壁纸 ${WALLPAPERS.length} 张，用户 ${USERS.length} 个)`)
  console.log('[mock] 演示账号：admin / 任意密码（管理员）  或  test01 / 任意密码（普通用户）')
})
