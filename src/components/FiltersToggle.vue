<template>
  <div class="filters-toggle-container">
    <div class="feature-count">
      <img src="/custom-marker-hover.png" alt="Custom Marker"> 
      <div class="feature-counter">
        <span>{{ featureCount }}</span>
        <span style="display: block;">пзк</span>
      </div>
    </div>
    <input
      v-model="localSearch"
      @input="onInput"
      @keyup.enter="onEnter"
      placeholder="Поиск по имени или статье"
      class="search-input"
    />
    <button
      class="filters-toggle"
      @click="toggleFilter('names')"
      :class="{
        'active-panel': activeFilterCategory === 'names',
        'active-filter': hasActiveNameFilters
      }"
    >
      Имена
    </button>
    <button
      class="filters-toggle"
      @click="toggleFilter('clauses')"
      :class="{
        'active-panel': activeFilterCategory === 'clauses',
        'active-filter': hasActiveClauseFilters
      }"
    >
      Статьи
    </button>
    <button
      class="filters-toggle"
      @click="toggleFilter('tags')"
      :class="{
        'active-panel': activeFilterCategory === 'tags',
        'active-filter': hasActiveTagFilters
      }"
    >
      Дела
    </button>
    <button
      class="filters-toggle"
      @click="$emit('reset-filters')"
      :class="{ 'active-filter': hasAnyActiveFilters }"
    >
      Сбросить
    </button>
  </div>
</template>

<script>
import debounce from 'lodash/debounce';

export default {
  name: 'FiltersToggle',
  props: {
    featureCount: {
      type: Number,
      required: true,
    },
    searchQuery: {
      type: String,
      required: true,
    },
    activeFilterCategory: {
      type: String,
      default: null,
    },
    hasActiveNameFilters: {
      type: Boolean,
      default: false,
    },
    hasActiveClauseFilters: {
      type: Boolean,
      default: false,
    },
    hasActiveTagFilters: {
      type: Boolean,
      default: false,
    },
    hasAnyActiveFilters: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      localSearch: this.searchQuery,
    };
  },
  methods: {
    onInput: debounce(function () {
      this.$emit('search-input', this.localSearch);
    }, 300),
    onEnter() {
      this.$emit('search-enter');
    },
    toggleFilter(category) {
      this.$emit('toggle-filter', category);
    },
  },
};
</script>

<style scoped> 
</style>
