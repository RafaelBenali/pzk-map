<template>
  <div class="modal" @click="closeModal">
    <div class="modal-content" @click.stop>
      <span class="close-button" @click="closeModal">&times;</span>
      <div v-if="selectedFeature">
        <button
          v-if="currentFeatures.length > 1"
          class="back-button"
          @click="backToList"
        >
          Обратно к списку
        </button>
        <div class="main-info" v-if="selectedFeature.properties.imageFilename">
          <h3>{{ selectedFeature.properties.name || 'Без названия' }}</h3>
          <img
            :src="getImageUrl(selectedFeature.properties.imageFilename)"
            :alt="selectedFeature.properties.name || 'Feature Image'"
            class="feature-image"
            @error="handleImageError"
          />
        </div>
        <div v-if="selectedFeature.properties.linkink" class="external-link">
          <a
            :href="selectedFeature.properties.linkink"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ selectedFeature.properties.linkink }}
          </a>
        </div>
        <div
          v-for="(content, index) in selectedFeature.properties.main"
          :key="'content-' + index"
          class="content-section"
          v-html="sanitizeHTML(content)"
        ></div>
        <div v-if="selectedFeature.properties.address?.length" class="address-section">
          <span class="tag-label">Адрес для писем:</span>
          <div
            v-for="(addr, index) in selectedFeature.properties.address"
            :key="'addr-' + index"
            class="address-line"
            v-html="sanitizeHTML(addr)"
          ></div>
        </div>
        <div v-if="selectedFeature.properties.clauses?.length" class="clauses-section">
          <span class="tag-label">Статьи:</span>
          <ul>
            <li
              v-for="clause in selectedFeature.properties.clauses"
              :key="clause"
            >
              {{ clause }}
            </li>
          </ul>
        </div>
        <div v-if="selectedFeature.properties.sourceUrl" class="source-link">
          <a
            :href="selectedFeature.properties.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Поддержка политзаключённых. Мемориал
          </a>
        </div>
      </div>
      <div v-else>
        <ul class="feature-list">
          <li
            v-for="feature in sortedFeatures"
            :key="getFeatureKey(feature)"
            @click="showFeatureDetails(feature)"
            class="feature-list-item"
            :title="feature.properties.name || 'Без названия'"
          >
            {{ feature.properties.name || 'Без названия' }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import DOMPurify from 'dompurify'

export default {
  name: 'Modal',
  props: {
    currentFeatures: {
      type: Array,
      default: () => []
    },
    selectedFeature: {
      type: Object,
      default: null
    }
  },
  emits: ['closeModal', 'backToList', 'update:selectedFeature'],
  setup(props, { emit }) {
    // Computed property to sort features by name
    const sortedFeatures = computed(() => {
      // Create a shallow copy before sorting to avoid mutating the original array
      return props.currentFeatures.slice().sort((a, b) => {
        // Ensure both names are strings; use an empty string if name is missing
        const nameA = (a.properties.name || '').toLowerCase()
        const nameB = (b.properties.name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })
    })

    function closeModal(event) {
      if (
        event.target.classList.contains('modal') ||
        event.target.classList.contains('close-button')
      ) {
        emit('closeModal')
      }
    }

    function backToList() {
      emit('backToList')
    }

    function showFeatureDetails(feature) {
      emit('update:selectedFeature', feature)
    }

    function getImageUrl(filename) {
      return `${import.meta.env.VITE_ASSETS_BASE_URL}/images/${filename}`
    }

    function handleImageError(event) {
      event.target.style.display = 'none'
    }

    function sanitizeHTML(html) {
      return DOMPurify.sanitize(html)
    }

    function getFeatureKey(feature) {
      return (
        feature.properties.name ||
        feature.properties.id ||
        JSON.stringify(feature.geometry.coordinates)
      )
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        emit('closeModal')
      }
    }

    onMounted(() => {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    })

    onBeforeUnmount(() => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    })

    return {
      closeModal,
      backToList,
      showFeatureDetails,
      getImageUrl,
      handleImageError,
      sanitizeHTML,
      getFeatureKey,
      sortedFeatures  
    }
  }
}
</script>

<style scoped>

.feature-image {
	max-height: 300px;
	margin-bottom: 10px;
}
.tag-label {
	margin-top: 20px;
	display: block;
	font-weight: 700;
}
  
</style>