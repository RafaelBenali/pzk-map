import { defineStore } from 'pinia';

// Constants
const DEFAULT_START_DATE = new Date(2000, 0, 1);
const DEFAULT_END_DATE = new Date(2024, 11, 31);

// Unified date parsing function that handles both "DD/MM/YYYY" and "DD-MM-YYYY" formats
function parseAnyDate(dateStr) {
  if (!dateStr) return null;
  const separator = dateStr.includes('/') ? '/' : dateStr.includes('-') ? '-' : null;
  if (!separator) return null;
  
  const parts = dateStr.split(separator);
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // JavaScript months are 0-indexed
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  return new Date(year, month, day);
}

// Consistent function to format a date into a month key for comparison
function formatMonthKey(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Keep original functions for compatibility but use the unified function internally
function parseDate(dateStr) {
  return parseAnyDate(dateStr);
}

function parseManifestDate(dateStr) {
  return parseAnyDate(dateStr);
}

// Common filtering logic
function applyCommonFilters(features, filters, isGraphMode) {
  return features.filter(feat => {
    // Apply dateStatus check only when in graph mode
    if (isGraphMode && feat.properties.dateStatus !== "True") return false;
    
    if (filters.selectedNames.length &&
        !filters.selectedNames.includes(feat.properties.name))
      return false;
    if (filters.selectedClauses.length &&
        !feat.properties.clauses?.some(c => filters.selectedClauses.includes(c)))
      return false;
    if (filters.selectedTags.length &&
        !feat.properties.tags?.some(t => filters.selectedTags.includes(t)))
      return false;
    if (filters.filterLinkink && !feat.properties.linkink)
      return false;
    if (filters.filterGeocodeStatus === false &&
        feat.properties.geocodeStatus === 'rf')
      return false;
    return true;
  });
}

export const useMapStore = defineStore('map', {
  state: () => ({
    fullRangeStart: DEFAULT_START_DATE,
    fullRangeEnd: DEFAULT_END_DATE,
    effectiveFullRangeStart: DEFAULT_START_DATE,
    effectiveFullRangeEnd: DEFAULT_END_DATE,
    monthlyData: [],
    manifestData: {},
    filters: {
      selectedNames: [],
      selectedClauses: [],
      selectedTags: [],
      searchQuery: '',
      filterLinkink: false,
      filterGeocodeStatus: true
    },
    dateRange: {
      startDate: DEFAULT_START_DATE,
      endDate: DEFAULT_END_DATE,
      isGraphMode: false,
      selectedRangeMonths: null
    },
    displayCount: 0,
    geojsonData: null,
    maxCount: 0,
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
    totalMonths(state) {
      const start = state.fullRangeStart;
      const end = state.fullRangeEnd;
      return (end.getFullYear() - start.getFullYear()) * 12 +
             (end.getMonth() - start.getMonth()) + 1;
    },
    effectiveTotalMonths(state) {
      const start = state.effectiveFullRangeStart;
      const end = state.effectiveFullRangeEnd;
      return (end.getFullYear() - start.getFullYear()) * 12 +
             (end.getMonth() - start.getMonth()) + 1;
    },
    hasActiveFilters(state) {
      return state.filters.selectedNames.length > 0 ||
             state.filters.selectedClauses.length > 0 ||
             state.filters.selectedTags.length > 0 ||
             state.filters.filterLinkink ||
             state.filters.filterGeocodeStatus === false;
    },
    filteredFeatures(state) {
      if (!state.geojsonData?.features) return [];
      
      // Use common filter function
      let filtered = applyCommonFilters(
        state.geojsonData.features,
        state.filters,
        state.dateRange.isGraphMode
      );
      
      if (state.dateRange.isGraphMode) {
        // Extract date range boundaries
        const startKey = formatMonthKey(state.dateRange.startDate);
        const endKey = formatMonthKey(state.dateRange.endDate);
        
        filtered = filtered.filter(f => {
          if (!f.properties.date) return false;
          const fd = parseDate(f.properties.date);
          if (!fd) return false;
          
          // Format the feature date in the same way we do for histogram
          const featureKey = formatMonthKey(fd);
          
          // Simple string comparison works for YYYY-MM format
          return featureKey >= startKey && featureKey <= endKey;
        });
      }
      
      return filtered;
    },
    availableNames(state) {
      if (!state.geojsonData?.features) return [];
      return [...new Set(
        state.geojsonData.features
          .filter(f => !state.dateRange.isGraphMode || f.properties.dateStatus === "True") // Apply filter only in graph mode
          .map(f => f.properties.name)
          .filter(Boolean)
      )].sort();
    },
    availableClauses(state) {
      if (!state.geojsonData?.features) return [];
      return [...new Set(
        state.geojsonData.features
          .filter(f => !state.dateRange.isGraphMode || f.properties.dateStatus === "True") // Apply filter only in graph mode
          .flatMap(f => f.properties.clauses || [])
      )].sort();
    }
  },
  
  actions: {
    setManifestData(manifest) {
      this.manifestData = manifest;
      if (manifest.latestUpdate) {
        const newEnd = parseManifestDate(manifest.latestUpdate);
        if (newEnd) {
          this.fullRangeEnd = newEnd;
          this.dateRange.endDate = newEnd;
        }
      }
      // Keep start date fixed at January 2000
      this.fullRangeStart = DEFAULT_START_DATE;
      this.effectiveFullRangeStart = DEFAULT_START_DATE;
      this.dateRange.startDate = DEFAULT_START_DATE;
      
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    updateFilters(newFilters) {
      this.filters = { ...this.filters, ...newFilters };
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    updateDateRange(newRange) {
      // Ensure start date is never changed from January 2000 if the full range is selected
      if (newRange.selectedRangeMonths === this.totalMonths) {
        newRange.startDate = DEFAULT_START_DATE;
      }
      
      this.dateRange = { ...this.dateRange, ...newRange };
      this.updateDisplayCount(); 
    },
    updateDisplayCount() {
      this.displayCount = this.filteredFeatures.length;
    },
    updateMonthlyData() {
      if (!this.geojsonData?.features) return;
      
      // Use common filter function
      const nonDateFiltered = applyCommonFilters(
        this.geojsonData.features,
        this.filters,
        this.dateRange.isGraphMode
      );
      
      const datedFeatures = nonDateFiltered.filter(f => {
        if (!f.properties.date) return false;
        const fd = parseDate(f.properties.date);
        return fd && !isNaN(fd);
      });
      
      // Calculate month counts
      const monthCounts = {};
      datedFeatures.forEach(ft => {
        const d = parseDate(ft.properties.date);
        if (!d) return;
        const key = formatMonthKey(d);
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });
      
      // Determine effective date range
      const keys = Object.keys(monthCounts);
      if (keys.length > 0) {
        // Keep the effective start fixed at January 2000
        this.effectiveFullRangeStart = DEFAULT_START_DATE;
        this.effectiveFullRangeEnd = new Date(Math.max(...keys.map(k => {
          const [year, monthStr] = k.split('-');
          return new Date(parseInt(year), parseInt(monthStr) - 1);
        })));
      } else {
        this.effectiveFullRangeStart = DEFAULT_START_DATE;
        this.effectiveFullRangeEnd = new Date(this.fullRangeEnd);
      }
      
      // Build monthly data array
      const monthlyData = [];
      let currentYear = this.effectiveFullRangeStart.getFullYear();
      let currentMonth = this.effectiveFullRangeStart.getMonth();
      
      // Include current year with empty bars
      const today = new Date();
      let finalYear, finalMonth;
      
      // If the current year is reached (or exceeded effectiveEnd), show full year (until December)
      if (today.getFullYear() >= this.effectiveFullRangeEnd.getFullYear()) {
        finalYear = today.getFullYear();
        finalMonth = 11; // December (month 11)
      } else {
        finalYear = this.effectiveFullRangeEnd.getFullYear();
        finalMonth = this.effectiveFullRangeEnd.getMonth();
      }
      
      while (currentYear < finalYear || (currentYear === finalYear && currentMonth <= finalMonth)) {
        const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const count = monthCounts[key] || 0;
        const date = new Date(currentYear, currentMonth);
        
        // Check if this date is after the latest data date
        const isAfterEffectiveEnd = date > this.effectiveFullRangeEnd;
        
        monthlyData.push({
          date: key,
          count,
          label: date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' }),
          year: currentYear,
          month: currentMonth,
          isAfterEffectiveEnd // Flag to identify months beyond the data range
        });
        
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      
      this.monthlyData = monthlyData;
      this.maxCount = Math.max(...monthlyData.map(m => m.count), 1);
    },
    setGeojsonData(data) {
      this.geojsonData = data;
      if (!this.dateRange.selectedRangeMonths) {
        this.dateRange.selectedRangeMonths = this.totalMonths;
      }
      
      // Initialize the dateRange
      this.dateRange.startDate = DEFAULT_START_DATE;
      this.dateRange.endDate = new Date(this.fullRangeEnd);
      
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    resetStore(useFullReset = false) {
      // Reset filters
      this.filters.selectedNames = [];
      this.filters.selectedClauses = [];
      this.filters.selectedTags = [];
      this.filters.searchQuery = '';
      this.filters.filterLinkink = false;
      this.filters.filterGeocodeStatus = true;
      
      // Reset graph mode
      this.dateRange.isGraphMode = false;
      
      // Reset playback
      this.playback.isPlaying = false;
      this.playback.isPlayingBackwards = false;
      this.playback.isPaused = true;
      
      // Always reset start date to January 2000
      this.dateRange.startDate = DEFAULT_START_DATE;
      
      // Set end date and range based on reset type
      if (useFullReset) {
        // Full reset - use full range
        this.dateRange.endDate = new Date(this.fullRangeEnd);
        this.dateRange.selectedRangeMonths = this.totalMonths;
      } else {
        // Effective reset - use effective range (data range)
        this.dateRange.endDate = new Date(this.effectiveFullRangeEnd);
        this.dateRange.selectedRangeMonths = this.effectiveTotalMonths;
      }
      
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    // Maintain backward compatibility with existing function names
    resetFilters() {
      this.resetStore(true); // true = use full reset
    },
    resetAll() {
      this.resetStore(false); // false = use effective reset
    },
    updatePlaybackState(newState) {
      this.playback = { ...this.playback, ...newState };
    }
  }
});