import React, { useEffect, useState } from 'react'

function App() {
  const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''

  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [newFolderName, setNewFolderName] = useState('')
  const [activeTarget, setActiveTarget] = useState('main')
  const [newTask, setNewTask] = useState('')
  const [isImportant, setIsImportant] = useState(false)
  const [isUrgent, setIsUrgent] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [syncError, setSyncError] = useState('')

  const getApiUrl = (path) => `${apiBaseUrl}${path}`

  useEffect(() => {
    const loadState = async () => {
      try {
        const response = await fetch(getApiUrl('/api/state'))
        if (!response.ok) {
          throw new Error('Failed to load state')
        }

        const data = await response.json()
        setTasks(Array.isArray(data.tasks) ? data.tasks : [])
        setFolders(Array.isArray(data.folders) ? data.folders : [])
      } catch (_error) {
        setSyncError('Backend not reachable. Using local in-memory data.')
      } finally {
        setIsLoading(false)
      }
    }

    loadState()
  }, [])

  const persistState = async (nextTasks, nextFolders) => {
    try {
      const response = await fetch(getApiUrl('/api/state'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tasks: nextTasks, folders: nextFolders })
      })

      if (!response.ok) {
        throw new Error('Failed to persist state')
      }

      setSyncError('')
    } catch (_error) {
      setSyncError('Changes are local only because API sync failed.')
    }
  }

  const addFolder = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    const folder = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: newFolderName.trim(),
      tasks: []
    }

    const nextFolders = [...folders, folder]

    setFolders(nextFolders)
    setNewFolderName('')
    setActiveTarget(folder.id)

    await persistState(tasks, nextFolders)
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTask.trim()) return
    
    const task = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: newTask.trim(),
      important: isImportant,
      urgent: isUrgent,
      completed: false,
      createdAt: new Date().toISOString()
    }

    if (activeTarget === 'main') {
      const nextTasks = [...tasks, task]
      setTasks(nextTasks)
      await persistState(nextTasks, folders)
    } else {
      const nextFolders =
        folders.map(folder =>
          folder.id === activeTarget
            ? { ...folder, tasks: [...folder.tasks, task] }
            : folder
        )
      setFolders(nextFolders)
      await persistState(tasks, nextFolders)
    }

    setNewTask('')
    setIsImportant(false)
    setIsUrgent(false)
  }

  const toggleComplete = async (id, folderId = null) => {
    if (folderId) {
      const nextFolders =
        folders.map(folder =>
          folder.id === folderId
            ? {
                ...folder,
                tasks: folder.tasks.map(t =>
                  t.id === id ? { ...t, completed: !t.completed } : t
                )
              }
            : folder
        )
      setFolders(nextFolders)
      await persistState(tasks, nextFolders)
      return
    }

    const nextTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    setTasks(nextTasks)
    await persistState(nextTasks, folders)
  }

  const deleteTask = async (id, folderId = null) => {
    if (folderId) {
      const nextFolders =
        folders.map(folder =>
          folder.id === folderId
            ? { ...folder, tasks: folder.tasks.filter(t => t.id !== id) }
            : folder
        )
      setFolders(nextFolders)
      await persistState(tasks, nextFolders)
      return
    }

    const nextTasks = tasks.filter(t => t.id !== id)
    setTasks(nextTasks)
    await persistState(nextTasks, folders)
  }

  const getQuadrant = (task) => {
    if (task.important && task.urgent) return 1
    if (task.important && !task.urgent) return 2
    if (!task.important && task.urgent) return 3
    return 4
  }

  const sortedTasks = [...tasks]
    .filter(t => !t.completed)
    .sort((a, b) => {
      const qa = getQuadrant(a)
      const qb = getQuadrant(b)
      return qa - qb
    })

  const completedTasks = tasks.filter(t => t.completed)

  const getQuadrantName = (q) => {
    switch(q) {
      case 1: return 'Q1: Do First'
      case 2: return 'Q2: Schedule'
      case 3: return 'Q3: Delegate'
      case 4: return 'Q4: Eliminate'
    }
  }

  const getQuadrantHeaderClass = (q) => {
    switch (q) {
      case 1: return 'bg-white text-black'
      case 2: return 'bg-zinc-200 text-zinc-900'
      case 3: return 'bg-zinc-700 text-zinc-100'
      default: return 'bg-zinc-900 text-zinc-200'
    }
  }

  const getQuadrantDotClass = (q) => {
    switch (q) {
      case 1: return 'bg-white border-zinc-300'
      case 2: return 'bg-zinc-300 border-zinc-500'
      case 3: return 'bg-zinc-600 border-zinc-400'
      default: return 'bg-zinc-900 border-zinc-500'
    }
  }

  const renderTaskList = (taskItems, folderId = null) => {
    const sortedTasks = [...taskItems]
      .filter(t => !t.completed)
      .sort((a, b) => {
        const qa = getQuadrant(a)
        const qb = getQuadrant(b)
        return qa - qb
      })

    const completedTasks = taskItems.filter(t => t.completed)

    return (
      <>
        {sortedTasks.length === 0 && completedTasks.length === 0 && (
          <div className="px-6 py-16 text-center text-zinc-500">No tasks yet. Add your first task above.</div>
        )}

        {sortedTasks.map((task, index) => {
          const quadrant = getQuadrant(task)
          const prevQuadrant = index > 0 ? getQuadrant(sortedTasks[index - 1]) : null
          const showHeader = quadrant !== prevQuadrant

          return (
            <React.Fragment key={task.id}>
              {showHeader && (
                <div
                  className={`px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] ${getQuadrantHeaderClass(quadrant)}`}
                >
                  {getQuadrantName(quadrant)}
                </div>
              )}
              <div className="group flex items-center gap-4 border-b border-zinc-800 px-6 py-4 transition hover:bg-zinc-900/60">
                <button
                  className="h-6 w-6 rounded-full border border-zinc-500 text-zinc-300 transition hover:border-white hover:text-white"
                  onClick={() => toggleComplete(task.id, folderId)}
                >
                  ○
                </button>
                <span className="flex-1 text-sm text-zinc-100 md:text-base">{task.text}</span>
                <button
                  className="h-7 w-7 rounded-md text-lg leading-none text-zinc-500 transition hover:bg-zinc-800 hover:text-white"
                  onClick={() => deleteTask(task.id, folderId)}
                >
                  ×
                </button>
              </div>
            </React.Fragment>
          )
        })}

        {completedTasks.length > 0 && (
          <>
            <div className="mt-2 border-t border-zinc-800 bg-zinc-950 px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Completed</div>
            {completedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-4 border-b border-zinc-800 px-6 py-4">
                <button
                  className="h-6 w-6 rounded-full border border-white bg-white text-sm text-black"
                  onClick={() => toggleComplete(task.id, folderId)}
                >
                  ✓
                </button>
                <span className="flex-1 text-sm text-zinc-500 line-through md:text-base">{task.text}</span>
                <button
                  className="h-7 w-7 rounded-md text-lg leading-none text-zinc-600 transition hover:bg-zinc-800 hover:text-white"
                  onClick={() => deleteTask(task.id, folderId)}
                >
                  ×
                </button>
              </div>
            ))}
          </>
        )}
      </>
    )
  }

  const activeFolder = activeTarget === 'main'
    ? null
    : folders.find(folder => folder.id === activeTarget)

  const activeTasks = activeFolder ? activeFolder.tasks : tasks

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-zinc-100 md:px-8">
      <div className="mx-auto max-w-4xl rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black shadow-[0_30px_100px_rgba(255,255,255,0.08)]">
        <header className="border-b border-zinc-800 px-6 py-8 md:px-10">
          <h1 className="text-2xl font-semibold text-white md:text-3xl">Covey Matrix Task Manager</h1>
          {syncError && <p className="mt-3 text-sm text-red-400">{syncError}</p>}
        </header>

        <section className="border-b border-zinc-800 px-6 py-6 md:px-10">
          <form onSubmit={addTask} className="space-y-4">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Adding task to <span className="text-zinc-200">{activeFolder ? activeFolder.name : 'Main Tasks'}</span>
            </div>

            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-white"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${isImportant ? 'border-emerald-500 bg-emerald-500 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-400' : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'}`}
                onClick={() => setIsImportant(!isImportant)}
              >
                {isImportant ? 'Important' : 'Not Important'}
              </button>
              <button
                type="button"
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${isUrgent ? 'border-red-500 bg-red-500 text-red-950 hover:border-red-400 hover:bg-red-400' : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'}`}
                onClick={() => setIsUrgent(!isUrgent)}
              >
                {isUrgent ? 'Urgent' : 'Not Urgent'}
              </button>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl border border-white bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Add Task
            </button>
          </form>
        </section>

        <section className="border-b border-zinc-800 px-6 py-6 md:px-10">
          <form onSubmit={addFolder} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Create new folder"
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-white"
            />
            <button
              type="submit"
              className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 transition hover:border-white"
            >
              Create Folder
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${activeTarget === 'main' ? 'border-white bg-white text-black' : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'}`}
              onClick={() => setActiveTarget('main')}
            >
              Main Tasks
            </button>
            {folders.map(folder => (
              <button
                key={folder.id}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${activeTarget === folder.id ? 'border-white bg-white text-black' : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500'}`}
                onClick={() => setActiveTarget(folder.id)}
              >
                {folder.name}
              </button>
            ))}
          </div>
        </section>

        <section className="border-b border-zinc-800 bg-zinc-950/70 px-6 py-4 md:px-10">
          <div className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
            {[1, 2, 3, 4].map((quadrant) => (
              <div key={quadrant} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full border ${getQuadrantDotClass(quadrant)}`}></span>
                <span>{getQuadrantName(quadrant)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-h-[520px] overflow-y-auto">
          {isLoading ? (
            <div className="px-6 py-16 text-center text-zinc-500">Loading tasks...</div>
          ) : (
            renderTaskList(activeTasks, activeFolder ? activeFolder.id : null)
          )}
        </section>
      </div>
    </main>
  )
}

export default App
