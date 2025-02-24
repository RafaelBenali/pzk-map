import { defineStore } from 'pinia';

// Helper function to parse dates in "DD/MM/YYYY" format.
function parseDate(dateStr) {
  const parts = dateStr.split('/');
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Helper to parse manifest date in "DD-MM-YYYY" format.
function parseManifestDate(dateStr) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  return new Date(year, month - 1, day);
}

export const useMapStore = defineStore('map', {
  state: () => ({
    fullRangeStart: new Date(2000, 0, 1),
    fullRangeEnd: new Date(2024, 11, 31),
    effectiveFullRangeStart: new Date(2000, 0, 1),
    effectiveFullRangeEnd: new Date(2024, 11, 31),
    monthlyData: [],
    effectiveMonthlyData: [],
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
      startDate: new Date(2000, 0, 1),
      endDate: new Date(2024, 11, 31),
      isGraphMode: false,
      selectedRangeMonths: null
    },
    displayCount: 0,
    geojsonData: null,
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
      let filtered = state.geojsonData.features.filter(feat => {
        if (state.filters.selectedNames.length &&
            !state.filters.selectedNames.includes(feat.properties.name))
          return false;
        if (state.filters.selectedClauses.length &&
            !feat.properties.clauses?.some(c => state.filters.selectedClauses.includes(c)))
          return false;
        if (state.filters.selectedTags.length &&
            !feat.properties.tags?.some(t => state.filters.selectedTags.includes(t)))
          return false;
        if (state.filters.filterLinkink && !feat.properties.linkink)
          return false;
        if (state.filters.filterGeocodeStatus === false &&
            feat.properties.geocodeStatus === 'rf')
          return false;
        return true;
      });
      if (state.dateRange.isGraphMode) {
        filtered = filtered.filter(f => {
          if (!f.properties.date) return false;
          const fd = parseDate(f.properties.date);
          return fd >= state.dateRange.startDate && fd <= state.dateRange.endDate;
        });
      }
      return filtered;
    },
    availableNames(state) {
      if (!state.geojsonData?.features) return [];
      return [...new Set(
        state.geojsonData.features
          .map(f => f.properties.name)
          .filter(Boolean)
      )].sort();
    },
    availableClauses(state) {
      if (!state.geojsonData?.features) return [];
      return [...new Set(
        state.geojsonData.features
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
    },
    updateFilters(newFilters) {
      this.filters = { ...this.filters, ...newFilters };
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    updateDateRange(newRange) {
      this.dateRange = { ...this.dateRange, ...newRange };
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    updateDisplayCount() {
      this.displayCount = this.filteredFeatures.length;
    },
    updateMonthlyData() {
      if (!this.geojsonData?.features) return;
      let nonDateFiltered = this.geojsonData.features.filter(feat => {
        if (this.filters.selectedNames.length &&
            !this.filters.selectedNames.includes(feat.properties.name))
          return false;
        if (this.filters.selectedClauses.length &&
            !feat.properties.clauses?.some(c => this.filters.selectedClauses.includes(c)))
          return false;
        if (this.filters.selectedTags.length &&
            !feat.properties.tags?.some(t => this.filters.selectedTags.includes(t)))
          return false;
        if (this.filters.filterLinkink && !feat.properties.linkink)
          return false;
        if (this.filters.filterGeocodeStatus === false &&
            feat.properties.geocodeStatus === 'rf')
          return false;
        return true;
      });
      const datedFeatures = nonDateFiltered.filter(f => {
        if (!f.properties.date) return false;
        const fd = parseDate(f.properties.date);
        return !isNaN(fd);
      });
      const monthCounts = {};
      datedFeatures.forEach(ft => {
        const d = parseDate(ft.properties.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthCounts[key] = (monthCounts[key] || 0) + 1;
      });
      const keys = Object.keys(monthCounts);
      let effectiveStart, effectiveEnd;
      if (keys.length > 0) {
        effectiveStart = new Date(Math.min(...keys.map(k => {
          const [year, monthStr] = k.split('-');
          return new Date(parseInt(year), parseInt(monthStr) - 1);
        })));
        effectiveEnd = new Date(Math.max(...keys.map(k => {
          const [year, monthStr] = k.split('-');
          return new Date(parseInt(year), parseInt(monthStr) - 1);
        })));
      } else {
        effectiveStart = new Date(this.fullRangeStart);
        effectiveEnd = new Date(this.fullRangeEnd);
      }
      this.effectiveFullRangeStart = effectiveStart;
      this.effectiveFullRangeEnd = effectiveEnd;
      const monthlyData = [];
      let currentYear = effectiveStart.getFullYear();
      let currentMonth = effectiveStart.getMonth();
      const endYear = effectiveEnd.getFullYear();
      const endMonth = effectiveEnd.getMonth();
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const key = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const count = monthCounts[key] || 0;
        const date = new Date(currentYear, currentMonth);
        monthlyData.push({
          date: key,
          count,
          label: date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' }),
          year: currentYear,
          month: currentMonth
        });
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }
      while (monthlyData.length && monthlyData[monthlyData.length - 1].count === 0) {
        monthlyData.pop();
      }
      this.monthlyData = monthlyData;
      this.effectiveMonthlyData = monthlyData.filter(m => m.count > 0);
      this.maxCount = Math.max(...monthlyData.map(m => m.count), 1);
      
      const labels = [];
      monthlyData.forEach((m, index) => {
        if (index === 0 || m.year !== monthlyData[index - 1].year) {
          labels.push({ year: m.year, left: (index * 7) + 'px' });
        }
      });
      this.yearLabels = labels;
    },
    setGeojsonData(data) {
      this.geojsonData = data;
      if (!this.dateRange.selectedRangeMonths) {
        this.dateRange.selectedRangeMonths = this.totalMonths;
      }
      this.processInitialData();
    },
    processInitialData() {
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    resetFilters() {
      this.filters.selectedNames = [];
      this.filters.selectedClauses = [];
      this.filters.selectedTags = [];
      this.filters.searchQuery = '';
      this.filters.filterLinkink = false;
      this.filters.filterGeocodeStatus = true;
      this.dateRange.isGraphMode = false;
      this.dateRange.startDate = new Date(this.fullRangeStart);
      this.dateRange.endDate = new Date(this.fullRangeEnd);
      this.dateRange.selectedRangeMonths = this.totalMonths;
      this.playback.isPlaying = false;
      this.playback.isPlayingBackwards = false;
      this.playback.isPaused = true;
      this.updateDisplayCount();
      this.updateMonthlyData();
    },
    updatePlaybackState(newState) {
      this.playback = { ...this.playback, ...newState };
    },
    resetAll() {
      this.filters.selectedNames = [];
      this.filters.selectedClauses = [];
      this.filters.selectedTags = [];
      this.filters.searchQuery = '';
      this.filters.filterLinkink = false;
      this.filters.filterGeocodeStatus = true;
      this.dateRange.isGraphMode = false;
      this.dateRange.startDate = new Date(this.fullRangeStart);
      this.dateRange.endDate = new Date(this.effectiveFullRangeEnd);
      this.dateRange.selectedRangeMonths = this.effectiveTotalMonths;
      this.playback.isPlaying = false;
      this.playback.isPlayingBackwards = false;
      this.playback.isPaused = true;
      this.updateDisplayCount();
      this.updateMonthlyData();
    }
  }
});
