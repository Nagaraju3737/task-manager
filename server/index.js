import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientDistPath = path.resolve(__dirname, '../dist')

app.use(express.json({ limit: '1mb' }))

if (process.env.FRONTEND_URL) {
  app.use(cors({ origin: process.env.FRONTEND_URL }))
} else {
  app.use(cors())
}

const taskSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    important: { type: Boolean, default: false },
    urgent: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
)

const folderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    tasks: { type: [taskSchema], default: [] }
  },
  { _id: false }
)

const appStateSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    tasks: { type: [taskSchema], default: [] },
    folders: { type: [folderSchema], default: [] }
  },
  { timestamps: true }
)

const AppState = mongoose.model('AppState', appStateSchema)

const sanitizeTasks = (input) =>
  (Array.isArray(input) ? input : []).map((task) => ({
    id: String(task.id),
    text: String(task.text ?? '').trim(),
    important: Boolean(task.important),
    urgent: Boolean(task.urgent),
    completed: Boolean(task.completed),
    createdAt: task.createdAt ? new Date(task.createdAt) : new Date()
  }))

const sanitizeFolders = (input) =>
  (Array.isArray(input) ? input : []).map((folder) => ({
    id: String(folder.id),
    name: String(folder.name ?? '').trim(),
    tasks: sanitizeTasks(folder.tasks)
  }))

const getOrCreateState = async () => {
  let state = await AppState.findOne({ key: 'main' }).lean()
  if (!state) {
    state = await AppState.create({ key: 'main', tasks: [], folders: [] })
    return state.toObject()
  }
  return state
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/state', async (_req, res, next) => {
  try {
    const state = await getOrCreateState()
    res.json({ tasks: state.tasks, folders: state.folders })
  } catch (error) {
    next(error)
  }
})

app.put('/api/state', async (req, res, next) => {
  try {
    const tasks = sanitizeTasks(req.body.tasks).filter((task) => task.text)
    const folders = sanitizeFolders(req.body.folders).map((folder) => ({
      ...folder,
      tasks: folder.tasks.filter((task) => task.text)
    }))

    const state = await AppState.findOneAndUpdate(
      { key: 'main' },
      { tasks, folders },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean()

    res.json({ tasks: state.tasks, folders: state.folders })
  } catch (error) {
    next(error)
  }
})

if (process.env.NODE_ENV === 'production') {
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath))

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next()
      }

      res.sendFile(path.join(clientDistPath, 'index.html'))
    })
  } else {
    console.warn('Frontend build not found. Run "npm run build" during deploy to generate dist/.')
  }
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: 'Server error' })
})

const startServer = async () => {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Add it in your environment variables.')
  }

  await mongoose.connect(mongoUri)

  app.listen(PORT, () => {
    console.log(`API server is running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
