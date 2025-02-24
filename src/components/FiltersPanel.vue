<template>
  <div class="filters-container">
    <div class="filters-toggle-container">
      <input
        v-model="searchQuery"
        @input="handleSearch"
        @keyup.enter="handleSearchEnter"
        placeholder="Поиск по имени или статье"
        class="search-input"
      />
      <!-- Main Filters toggle button -->
      <button
        class="filters-toggle"
        @click="toggleFiltersPanel"
        :class="{
          'active-panel': filtersVisible,
          'active-filter': hasAnyActiveFilters
        }"
      >
        Фильтры
      </button>
      
      <!-- Inline additional filters (appear when filtersVisible is true) -->
      <div v-if="filtersVisible" class="inline-filters">
        <button
          class="filters-toggle"
          @click="setActiveFilter('names')"
          :class="{
            'active-panel': activeFilterCategory === 'names',
            'active-filter': hasActiveNameFilters
          }"
        >
          Имена
        </button>
        <button
          class="filters-toggle"
          @click="setActiveFilter('clauses')"
          :class="{
            'active-panel': activeFilterCategory === 'clauses',
            'active-filter': hasActiveClauseFilters
          }"
        >
          Статьи
        </button>
        <button
          class="filters-toggle"
          @click="setActiveFilter('tags')"
          :class="{
            'active-panel': activeFilterCategory === 'tags',
            'active-filter': hasActiveTagFilters
          }"
        >
          Дела
        </button>
        <div class="checkboxes">
          <label class="filter-label inline-checkbox">
            <input
              type="checkbox"
              v-model="linkinkEnabled"
            />
            <span></span>
            Группа поддержки
          </label>
          <label class="filter-label inline-checkbox">
            <input
              type="checkbox"
              v-model="geocodeStatusEnabled"
            />
            <span></span>
            Местоположение неизвестно
          </label>
        </div>
      </div>

      <!-- Reset Filters button -->
      <button
        class="filters-toggle"
        @click="resetFilters"
        :class="{ 'active-filter': hasAnyActiveFilters }"
      >
        Сбросить
      </button>
    </div>
    
    <!-- Category-specific filter list -->
    
    <div v-if="activeFilterCategory" class="filters">
      <div class="filters-content" @click.stop>
        <div v-if="activeFilterCategory === 'names'">
          <div v-if="filteredNames.length === 0" class="no-results">
            Ничего не найдено
          </div>
          <div 
            v-else 
            v-for="name in filteredNames" 
            :key="name" 
            class="filter-div"
          >
            <input
              type="checkbox"
              :value="name"
              v-model="selectedNames"
              :id="'filter-name-' + name"
            />
            <label 
              :for="'filter-name-' + name"
              class="filter-label" 
              @click.prevent="toggleFilter('names', name)"
            >
              {{ name }}
            </label>
          </div>
        </div>
        <div v-if="activeFilterCategory === 'clauses'">
          <div v-if="filteredClauses.length === 0" class="no-results">
            Ничего не найдено
          </div>
          <div 
            v-else 
            v-for="clause in filteredClauses" 
            :key="clause" 
            class="filter-div"
          >
            <input
              type="checkbox"
              :value="clause"
              v-model="selectedClauses"
              :id="'filter-clause-' + clause"
            />
            <label 
              :for="'filter-clause-' + clause"
              class="filter-label" 
              @click.prevent="toggleFilter('clauses', clause)"
            >
              {{ clause }}
            </label>
          </div>
        </div>
        <div v-if="activeFilterCategory === 'tags'">
          <div v-if="filteredTags.length === 0" class="no-results">
            Ничего не найдено
          </div>
          <div 
            v-else 
            v-for="tag in filteredTags" 
            :key="tag" 
            class="filter-div"
          >
            <input
              type="checkbox"
              :value="tag"
              v-model="selectedTags"
              :id="'filter-tag-' + tag"
            />
            <label 
              :for="'filter-tag-' + tag"
              class="filter-label" 
              @click.prevent="toggleFilter('tags', tag)"
            >
              {{ tag }}
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMapStore } from '../stores/mapStore'

export default {
  name: 'FiltersPanel',
  emits: ['filtersUpdated'],
  setup(props, { emit }) {
    const store = useMapStore()
    const filtersVisible = ref(false)
    const activeFilterCategory = ref(null)
    const searchQuery = ref('')
    const selectedNames = ref([])
    const selectedClauses = ref([])
    const selectedTags = ref([])

    // New additional filters
    const linkinkEnabled = ref(false)
    const geocodeStatusEnabled = ref(true)

    const hasActiveNameFilters = computed(() => selectedNames.value.length > 0)
    const hasActiveClauseFilters = computed(() => selectedClauses.value.length > 0)
    const hasActiveTagFilters = computed(() => selectedTags.value.length > 0)
    const hasActiveAdditionalFilters = computed(() => {
      return linkinkEnabled.value || !geocodeStatusEnabled.value
    })
    const hasAnyActiveFilters = computed(() =>
      hasActiveNameFilters.value ||
      hasActiveClauseFilters.value ||
      hasActiveTagFilters.value ||
      hasActiveAdditionalFilters.value
    )

    const filteredNames = computed(() => {
      let names = store.availableNames
      if (hasActiveClauseFilters.value || hasActiveTagFilters.value) {
        const filtered = store.filteredFeatures
        names = [...new Set(filtered.map(f => f.properties.name).filter(Boolean))]
      }
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        names = names.filter(name => name.toLowerCase().includes(query))
      }
      return names.sort()
    })

    const filteredClauses = computed(() => {
      let clauses = store.availableClauses
      if (hasActiveNameFilters.value || hasActiveTagFilters.value) {
        const filtered = store.filteredFeatures
        clauses = [...new Set(filtered.flatMap(f => f.properties.clauses || []))]
      }
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        clauses = clauses.filter(clause => clause.toLowerCase().includes(query))
      }
      return clauses.sort()
    })

    const filteredTags = computed(() => {
      let tags = store.predefinedTags
      if (hasActiveNameFilters.value || hasActiveClauseFilters.value) {
        const filtered = store.filteredFeatures
        const availableTags = new Set(filtered.flatMap(f => f.properties.tags || []))
        tags = tags.filter(tag => availableTags.has(tag))
      }
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        tags = tags.filter(tag => tag.toLowerCase().includes(query))
      }
      return tags
    })

    function toggleFiltersPanel() {
      filtersVisible.value = !filtersVisible.value
      if (!filtersVisible.value) {
        activeFilterCategory.value = null
      }
    }

    function setActiveFilter(category) {
      activeFilterCategory.value =
        activeFilterCategory.value === category ? null : category
    }

    function closeFiltersPanel() {
      filtersVisible.value = false
      activeFilterCategory.value = null
    }

    function handleSearch() {
      if (!searchQuery.value) return
      const isNum = /^\d/.test(searchQuery.value)
      filtersVisible.value = true
      activeFilterCategory.value = isNum ? 'clauses' : 'names'
    }

    function handleSearchEnter() {
      const isNum = /^\d/.test(searchQuery.value)
      const items = isNum ? filteredClauses.value : filteredNames.value
      if (items.length === 1) {
        const result = items[0]
        if (isNum && !selectedClauses.value.includes(result)) {
          selectedClauses.value.push(result)
        } else if (!isNum && !selectedNames.value.includes(result)) {
          selectedNames.value.push(result)
        }
        clearSearch()
        closeFiltersPanel()
      }
    }

    function clearSearch() {
      searchQuery.value = ''
    }

    function toggleFilter(type, value) {
      const target = { names: selectedNames, clauses: selectedClauses, tags: selectedTags }[type]
      const index = target.value.indexOf(value)
      if (index === -1) {
        target.value.push(value)
      } else {
        target.value.splice(index, 1)
      }
    }

    function resetFilters() {
      selectedNames.value = []
      selectedClauses.value = []
      selectedTags.value = []
      linkinkEnabled.value = false
      geocodeStatusEnabled.value = true
      clearSearch()
      closeFiltersPanel()
      store.resetAll()
      emitFilters()
    }

    function emitFilters() {
      const filters = {
        selectedNames: selectedNames.value,
        selectedClauses: selectedClauses.value,
        selectedTags: selectedTags.value,
        filterLinkink: linkinkEnabled.value,
        filterGeocodeStatus: geocodeStatusEnabled.value
      }
      emit('filtersUpdated', filters)
      store.updateFilters(filters)
    }

    watch(
      [selectedNames, selectedClauses, selectedTags, linkinkEnabled, geocodeStatusEnabled],
      () => {
        emitFilters()
      },
      { deep: true }
    )

    function handleClickOutside(event) {
      const container = document.querySelector('.filters-toggle-container')
      if (container && !container.contains(event.target)) {
        closeFiltersPanel()
      }
    }

    onMounted(() => {
      document.addEventListener('click', handleClickOutside)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    return {
      filtersVisible,
      activeFilterCategory,
      searchQuery,
      selectedNames,
      selectedClauses,
      selectedTags,
      linkinkEnabled,
      geocodeStatusEnabled,
      hasActiveNameFilters,
      hasActiveClauseFilters,
      hasActiveTagFilters,
      hasAnyActiveFilters,
      filteredNames,
      filteredClauses,
      filteredTags,
      toggleFiltersPanel,
      setActiveFilter,
      closeFiltersPanel,
      handleSearch,
      handleSearchEnter,
      clearSearch,
      toggleFilter,
      resetFilters
    }
  }
}
</script>


<style scoped>
.filters-toggle-container {
  position: absolute;
  top: 10px;
  left: 100px;
  z-index: 16; 
  gap: 10px;
  flex-wrap: wrap;
}
.search-input {
  background-color: black;
  border: 1px solid white;
  color: white;
  padding: 8px 12px;
  outline: none;
  margin: 10px 5px 10px 25px;
}
.filters-toggle {
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid black;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
  margin-top: 10px;
  left: 10px;
  position: relative;
} 
.filters-toggle:last-child {
	border-color: #fff !important;
}
.filters-toggle.active-filter {
  background-color: black !important;
  color: white !important;
  opacity: 0.8;
}
.filters-toggle-container .filters-toggle.active-panel, .filters-toggle-container .filters-toggle:hover {
	background-color: #000 !important;
	color: #fff;
	opacity: 1;
}
.filters {
  position: absolute;
  top: 80px;
  left: 10px;
  z-index: 199990;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  min-width: 500px;
  min-height: 100px;
  max-height: calc(100vh - 390px);
  overflow-y: auto; 
}
.filters, .filters-toggle {
	filter: invert(1);
}
.filters > div {
  padding: 10px;
}
.filters input {
  filter: saturate(0);
  width: 20px;
  height: 20px;
  position: absolute;
}
.filter-label {
  display: block;
  margin-left: 35px;
  margin-top: 3px;
  cursor: pointer;
  user-select: none;
}
.filter-label:hover {
  opacity: 0.8;
}
.filter-div {
  margin-bottom: 5px;
  position: relative;
  padding-top: 5px;
}
/* If top-level filter buttons are used */
.filter-buttons button {
  margin-right: 10px;
}

.checkboxes{
  padding-top: 14px;
  margin-left: 10px;
}
.inline-filters{
  display: inline-flex;
}
.inline-checkbox{
  color: white;
  margin-left: 0;
  font-size: 12px;
  margin-top: 0;
} 
.inline-checkbox input{
  margin: 0;
}
.inline-checkbox input {
  visibility: hidden; 
  display: block;
  height: 0;
  width: 0;
  position: absolute;
  overflow: hidden;
}
.inline-checkbox span { 
  height: 10px;
  width: 10px;
  border: 1px solid white;
  display: inline-block;
}
.inline-checkbox [type=checkbox]:checked + span {
  background: white;
}

@media (max-width: 1100px) {
  .filters {
    height: calc(100vh - 333px);
  }
}

/* For screens under 980px */
@media (max-width: 980px) {
  .filter-checkbox {
    position: fixed;
    bottom: 20px;
    left: 100px;
  }
  .filters-toggle-container .feature-count {
    right: 10px !important;
    left: auto !important;
    position: absolute;
    top: 10px;
  }
  .search-input {
    margin-left: 10px;
    float: none;
    display: block;
    margin-bottom: 10px;
    width: 211px;
  }
  .filters-toggle {
    float: none !important;
    margin-top: 0;
  } 
  .filters-toggle-container {
    width: 100%;
    left: 0;
    top: 0;
  }
  .filters-toggle:last-child {
    display: block;
    margin-top: 10px;
  }
  .filters {
    height: calc(100vh - 390px);
    top: 145px;
    width: calc(100vw - 60px);
    right: 20px;
    min-width: 0;
  }
}

</style>