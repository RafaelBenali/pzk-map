import { defineStore } from 'pinia'

// Helper function to parse dates in "DD/MM/YYYY" format.
function parseDate(dateStr) {
  const parts = dateStr.split('/')
  // parts[0] -> day, parts[1] -> month, parts[2] -> year
  return new Date(parts[2], parts[1] - 1, parts[0])
}

// Helper to parse manifest date in "DD-MM-YYYY" format.
function parseManifestDate(dateStr) {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const year = parseInt(parts[2], 10)
  return new Date(year, month - 1, day)
}

export const useMapStore = defineStore('map', {
  state: () => ({
    // Full range constants (never change, but fullRangeEnd will be updated from manifest)
    fullRangeStart: new Date(2000, 0, 1),
    fullRangeEnd: new Date(2024, 11, 31),

    // We'll store the manifest data here
    manifestData: {},

    // Filter state
    filters: {
      selectedNames: [],
      selectedClauses: [],
      selectedTags: [],
      searchQuery: ''
    },

    // Date-range state (selected range may be a subset of the full range)
    dateRange: {
      startDate: new Date(2000, 0, 1),
      endDate: new Date(2024, 11, 31),
      isGraphMode: false,
      selectedRangeMonths: null // will be set to full range months initially
    },

    // Other state
    displayCount: 0,
    geojsonData: null,
    monthlyData: [],
    maxCount: 0,
    yearLabels: [],
    playback: {
      isPlaying: false,
      isPlayingBackwards: false,
      isPaused: true,
      speed: 1,
      lastNonZeroIndex: 5,
      allRangeForwardInitialized: false,
      allRangeBackwardInitialized: false
    },
    predefinedTags: [
      'дела гражданских активистов', 'дела журналистов', 'дела мусульман',
      'дела о «шпионаже»', 'дела «украинских диверсантов»', 'дела о государственной измене',
      'дело антифашистов', 'преследование адвокатов', 'преследование крымских татар',
      'преследование свидетелей Иеговы', 'преследование сторонников Навального',
      'преследование украинцев', 'преследования по религиозному признаку',
      'принудительное лечение + карательная психиатрия', 'репрессии за антивоенную позицию',
      '«экстремистские» высказывания + антиэкстремистское законодательство', 'ЛГБТ',
      'Хизб ут-Тахрир', 'антитеррористическое законодательство', 'оправдание терроризма'
    ]
  }),

  getters: {
    // Always calculate total months using the fixed full range.
    totalMonths(state) {
      const start = state.fullRangeStart
      const end = state.fullRangeEnd
      return (end.getFullYear() - start.getFullYear()) * 12 +
             (end.getMonth() - start.getMonth()) + 1
    },

    hasActiveFilters(state) {
      return state.filters.selectedNames.length > 0 ||
             state.filters.selectedClauses.length > 0 ||
             state.filters.selectedTags.length > 0
    },

    filteredFeatures(state) {
      if (!state.geojsonData?.features) return []
      
      let filtered = state.geojsonData.features.filter(feat => {
        // Name filter
        if (state.filters.selectedNames.length && 
            !state.filters.selectedNames.includes(feat.properties.name)) {
          return false
        }
        // Clauses filter
        if (state.filters.selectedClauses.length && 
            !feat.properties.clauses?.some(c => state.filters.selectedClauses.includes(c))) {
          return false
        }
        // Tags filter
        if (state.filters.selectedTags.length && 
            !feat.properties.tags?.some(t => state.filters.selectedTags.includes(t))) {
          return false
        }
        return true
      })

      // Apply date filter only if Graph Mode is on.
      if (state.dateRange.isGraphMode) {
        filtered = filtered.filter(f => {
          if (!f.properties.date) return false
          const fd = parseDate(f.properties.date)
          return fd >= state.dateRange.startDate && fd <= state.dateRange.endDate
        })
      }
      return filtered
    },

    availableNames(state) {
      if (!state.geojsonData?.features) return []
      return [...new Set(
        state.geojsonData.features
          .map(f => f.properties.name)
          .filter(Boolean)
      )].sort()
    },

    availableClauses(state) {
      if (!state.geojsonData?.features) return []
      return [...new Set(
        state.geojsonData.features
          .flatMap(f => f.properties.clauses || [])
      )].sort()
    }
  },

  actions: {
    // New action to update store with manifest data.
    setManifestData(manifest) {
      this.manifestData = manifest
      if (manifest.latestUpdate) {
        const newEnd = parseManifestDate(manifest.latestUpdate)
        if (newEnd) {
          // Update the fixed full range end and the dateRange endDate
          this.fullRangeEnd = newEnd
          this.dateRange.endDate = newEnd
        }
      }
    },

    updateFilters(newFilters) {
      this.filters = { ...this.filters, ...newFilters }
      this.updateDisplayCount()
      this.updateMonthlyData()
    },

    updateDateRange(newRange) {
      this.dateRange = { ...this.dateRange, ...newRange }
      this.updateDisplayCount()
      this.updateMonthlyData()
    },

    updateDisplayCount() {
      this.displayCount = this.filteredFeatures.length
    },

    updateMonthlyData() {
      if (!this.geojsonData?.features) return
      
      const datedFeatures = this.filteredFeatures.filter(f => {
        if (!f.properties.date) return false
        const fd = parseDate(f.properties.date)
        return !isNaN(fd)
      })

      const monthCounts = {}
      datedFeatures.forEach(ft => {
        const d = parseDate(ft.properties.date)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthCounts[k] = (monthCounts[k] || 0) + 1
      })

      const monthlyData = []
      const start = this.fullRangeStart
      const end = this.fullRangeEnd
      let currentYear = start.getFullYear()
      let currentMonth = start.getMonth()
      const endYear = end.getFullYear()
      const endMonth = end.getMonth()

      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
        const count = monthCounts[key] || 0
        const date = new Date(currentYear, currentMonth)
        monthlyData.push({
          date: key,
          count,
          label: date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' }),
          year: currentYear,
          month: currentMonth
        })
        currentMonth++
        if (currentMonth > 11) {
          currentMonth = 0
          currentYear++
        }
      }

      this.monthlyData = monthlyData
      this.maxCount = Math.max(...monthlyData.map(m => m.count), 1)

      // Build year labels (for histogram)
      const years = [...new Set(monthlyData.map(m => m.year))]
      this.yearLabels = years.map(year => ({
        year,
        width: (monthlyData.filter(m => m.year === year).length / monthlyData.length) * 100
      }))
    },

    setGeojsonData(data) {
      this.geojsonData = data
      // Initialize the selected range to the full range if not already set.
      if (!this.dateRange.selectedRangeMonths) {
        this.dateRange.selectedRangeMonths = this.totalMonths
      }
      this.processInitialData()
    },

    processInitialData() {
      this.updateDisplayCount()
      this.updateMonthlyData()
    },

    resetFilters() {
      this.filters.selectedNames = []
      this.filters.selectedClauses = []
      this.filters.selectedTags = []
      this.filters.searchQuery = ''
      this.dateRange.isGraphMode = false
      this.dateRange.startDate = new Date(this.fullRangeStart)
      this.dateRange.endDate = new Date(this.fullRangeEnd)
      this.dateRange.selectedRangeMonths = this.totalMonths
      this.playback.isPlaying = false
      this.playback.isPlayingBackwards = false
      this.playback.isPaused = true
      this.updateDisplayCount()
      this.updateMonthlyData()
    },

    updatePlaybackState(newState) {
      this.playback = { ...this.playback, ...newState }
    },

    resetAll() {
      this.filters.selectedNames = []
      this.filters.selectedClauses = []
      this.filters.selectedTags = []
      this.dateRange.isGraphMode = false
      this.dateRange.startDate = new Date(this.fullRangeStart)
      this.dateRange.endDate = new Date(this.fullRangeEnd)
      this.dateRange.selectedRangeMonths = this.totalMonths
      this.playback.isPlaying = false
      this.playback.isPlayingBackwards = false
      this.playback.isPaused = true
      this.updateDisplayCount()
      this.updateMonthlyData()
    }
  }
})
