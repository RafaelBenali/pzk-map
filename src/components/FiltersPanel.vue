<template>
  <div>
    <div class="filters-toggle-container">
      <input
        v-model="searchQuery"
        @input="handleSearch"
        @keyup.enter="handleSearchEnter"
        placeholder="Поиск по имени или статье"
        class="search-input"
      />
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
      <button
        class="filters-toggle"
        @click="resetFilters"
        :class="{ 'active-filter': hasAnyActiveFilters }"
      >
        Сбросить
      </button>
    </div>
    <div
      v-if="filtersVisible"
      class="filters"
      @click="closeFiltersPanel"
    >
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

    const hasActiveNameFilters = computed(() => selectedNames.value.length > 0)
    const hasActiveClauseFilters = computed(() => selectedClauses.value.length > 0)
    const hasActiveTagFilters = computed(() => selectedTags.value.length > 0)
    const hasAnyActiveFilters = computed(
      () => hasActiveNameFilters.value || hasActiveClauseFilters.value || hasActiveTagFilters.value
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

    function setActiveFilter(category) {
      if (activeFilterCategory.value === category) {
        closeFiltersPanel()
      } else {
        activeFilterCategory.value = category
        filtersVisible.value = true
        clearSearch()
      }
    }

    function closeFiltersPanel() {
      filtersVisible.value = false
      activeFilterCategory.value = null
    }

    function handleSearch() {
      if (!searchQuery.value) return
      const isNum = /^\d/.test(searchQuery.value)
      const category = isNum ? 'clauses' : 'names'
      filtersVisible.value = true
      activeFilterCategory.value = category
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
      clearSearch()
      closeFiltersPanel()
      // Reset the entire state including date-range and Graph Mode.
      store.resetAll()
      emitFilters()
    }

    function emitFilters() {
      emit('filtersUpdated', {
        selectedNames: selectedNames.value,
        selectedClauses: selectedClauses.value,
        selectedTags: selectedTags.value
      })
    }

    function handleClickOutside(event) {
      const filterPanel = document.querySelector('.filters')
      const toggleContainer = document.querySelector('.filters-toggle-container')
      if (
        filterPanel &&
        !filterPanel.contains(event.target) &&
        toggleContainer &&
        !toggleContainer.contains(event.target)
      ) {
        closeFiltersPanel()
      }
    }

    watch(
      [selectedNames, selectedClauses, selectedTags],
      () => {
        emitFilters()
      },
      { deep: true }
    )

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
      hasActiveNameFilters,
      hasActiveClauseFilters,
      hasActiveTagFilters,
      hasAnyActiveFilters,
      filteredNames,
      filteredClauses,
      filteredTags,
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
  margin: 10px 15px 10px 25px;
}
.filters-toggle {
  padding: 8px 12px;
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid black;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 20px;
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