import { supabase, isSupabaseConfigured, initAuth, getUserId } from './supabase'

// Offline-first storage with Supabase sync
class StorageService {
  constructor() {
    this.syncQueue = []
    this.isOnline = navigator.onLine
    this.syncing = false
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true
      this.sync()
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
    })
    
    // Initialize auth if Supabase is configured
    if (isSupabaseConfigured()) {
      initAuth().then(() => {
        this.sync()
      })
    }
  }

  // Local storage helpers
  _localGet(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  }

  _localSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }

  // Get goals (offline-first)
  async getGoals(quarter = null) {
    const localGoals = this._localGet('r_goals', [])
    
    if (quarter) {
      return localGoals.filter(g => g.qtr === quarter)
    }
    return localGoals
  }

  // Save goals (offline-first, sync when online)
  async saveGoals(goals, quarter = null) {
    // Get all goals
    let allGoals = this._localGet('r_goals', [])
    
    if (quarter) {
      // Filter out goals from this quarter and add new ones
      allGoals = allGoals.filter(g => g.qtr !== quarter)
      allGoals = [...allGoals, ...goals]
    } else {
      // If goals is an array, replace all; otherwise assume it's the full array
      allGoals = Array.isArray(goals) ? goals : allGoals
    }
    
    // Save locally first (offline-first)
    this._localSet('r_goals', allGoals)
    
    // Queue for sync if Supabase is configured
    if (isSupabaseConfigured()) {
      this.queueSync('goals', allGoals)
    }
    
    return true
  }

  // Get logs (offline-first)
  async getLogs() {
    return this._localGet('r_logs', [])
  }

  // Save logs (offline-first, sync when online)
  async saveLogs(logs) {
    // Save locally first
    this._localSet('r_logs', logs)
    
    // Queue for sync if Supabase is configured
    if (isSupabaseConfigured()) {
      this.queueSync('logs', logs)
    }
    
    return true
  }

  // Queue item for sync
  queueSync(type, data) {
    this.syncQueue.push({ type, data, timestamp: Date.now() })
    
    // Try to sync immediately if online
    if (this.isOnline && !this.syncing) {
      this.sync()
    }
  }

  // Sync with Supabase
  async sync() {
    if (!isSupabaseConfigured() || !this.isOnline || this.syncing) {
      return
    }

    this.syncing = true
    
    try {
      const userId = await getUserId()
      if (!userId) {
        await initAuth()
        return
      }

      // Sync goals
      const localGoals = this._localGet('r_goals', [])
      if (localGoals.length > 0) {
        const { error } = await supabase
          .from('goals')
          .upsert(
            localGoals.map(g => ({
              id: g.id,
              user_id: userId,
              name: g.name,
              quarter: g.qtr,
              objectives: g.objs,
              created_at: g.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })),
            { onConflict: 'id,user_id' }
          )
        
        if (error) throw error
      }

      // Sync logs
      const localLogs = this._localGet('r_logs', [])
      if (localLogs.length > 0) {
        const { error } = await supabase
          .from('logs')
          .upsert(
            localLogs.map(l => ({
              id: l.id,
              user_id: userId,
              date: l.date,
              goal_id: l.goalId,
              objective_id: l.objId,
              intention: l.intention,
              reflection: l.reflection,
              status: l.status,
              closed: l.closed,
              created_at: l.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })),
            { onConflict: 'id,user_id' }
          )
        
        if (error) throw error
      }

      // Clear sync queue
      this.syncQueue = []
      
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      this.syncing = false
    }
  }

  // Pull latest data from Supabase (on app start)
  async pull() {
    if (!isSupabaseConfigured() || !this.isOnline) {
      return
    }

    try {
      const userId = await getUserId()
      if (!userId) return

      // Pull goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (goalsError) throw goalsError

      if (goalsData && goalsData.length > 0) {
        const syncedGoals = goalsData.map(g => ({
          id: g.id,
          name: g.name,
          qtr: g.quarter,
          objs: g.objectives || [],
          created_at: g.created_at
        }))
        
        // Merge with local (local takes precedence for conflicts)
        const localGoals = this._localGet('r_goals', [])
        const mergedGoals = this._mergeGoals(localGoals, syncedGoals)
        this._localSet('r_goals', mergedGoals)
      }

      // Pull logs
      const { data: logsData, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (logsError) throw logsError

      if (logsData && logsData.length > 0) {
        const syncedLogs = logsData.map(l => ({
          id: l.id,
          date: l.date,
          goalId: l.goal_id,
          objId: l.objective_id,
          intention: l.intention,
          reflection: l.reflection,
          status: l.status,
          closed: l.closed,
          created_at: l.created_at
        }))
        
        // Merge with local (local takes precedence for conflicts)
        const localLogs = this._localGet('r_logs', [])
        const mergedLogs = this._mergeLogs(localLogs, syncedLogs)
        this._localSet('r_logs', mergedLogs)
      }

    } catch (error) {
      console.error('Pull error:', error)
    }
  }

  // Merge goals (local takes precedence)
  _mergeGoals(local, remote) {
    const merged = [...local]
    const localIds = new Set(local.map(g => g.id))
    
    remote.forEach(remoteGoal => {
      if (!localIds.has(remoteGoal.id)) {
        merged.push(remoteGoal)
      }
    })
    
    return merged
  }

  // Merge logs (local takes precedence)
  _mergeLogs(local, remote) {
    const merged = [...local]
    const localKeys = new Set(local.map(l => `${l.id}-${l.date}`))
    
    remote.forEach(remoteLog => {
      const key = `${remoteLog.id}-${remoteLog.date}`
      if (!localKeys.has(key)) {
        merged.push(remoteLog)
      }
    })
    
    return merged.sort((a, b) => b.date.localeCompare(a.date))
  }
}

// Export singleton instance
export const storageService = new StorageService()

// Export simple get/set for backward compatibility
// Note: These are async but can be used with await
export const storage = {
  get: async (key, defaultValue = null) => {
    if (key === 'r_goals') {
      const goals = await storageService.getGoals()
      return goals || defaultValue
    } else if (key === 'r_logs') {
      const logs = await storageService.getLogs()
      return logs || defaultValue
    }
    // Fallback to localStorage for other keys (synchronous)
    try {
      return JSON.parse(localStorage.getItem(key)) || defaultValue
    } catch {
      return defaultValue
    }
  },
  
  set: async (key, value) => {
    if (key === 'r_goals') {
      return await storageService.saveGoals(value)
    } else if (key === 'r_logs') {
      return await storageService.saveLogs(value)
    }
    // Fallback to localStorage for other keys (synchronous)
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  }
}

