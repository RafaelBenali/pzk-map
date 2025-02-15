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
            v-for="feature in currentFeatures"
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
import { onMounted, onBeforeUnmount } from 'vue'
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
      getFeatureKey
    }
  }
}
</script>
<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  z-index: 16;
}
.modal-content {
  background: #fff;
  padding: 20px; 
  overflow-y: auto;
  border-radius: 8px;
  width: 500px;
  position: relative;
  max-height: calc(100vh - 140px);
  box-shadow: 0 2px 8px rgba(0,0,0,.3);
  position: absolute;  
  top: 52%;
  left: 50%;
  transform: translate(-50%,-50%);
  z-index: 999999;
}
.modal-content h3 {
  margin-top: 0;
  font-size: 18px;
  color: #333;
}
.modal-content p {
  margin: 10px 0;
  font-size: 14px;
  color: #555;
}
.modal-content button {
  margin-top: 15px;
  padding: 8px 16px; 
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.modal-content button:hover {
  background-color: #429ab8;
}
/* Force inversion for modal content (if needed) */
.modal-content, .modal-content * {
  background-color: #000009 !important;
  color: #ddd !important;
}
/* Positioning for buttons inside modal */
.modal-content button {
  position: absolute;
  right: 0;
  top: 0;
}
.modal li {
  list-style-type: none;
}
.modal li.feature-list-item {
  text-decoration: underline;
  margin-bottom: 5px;
}
.modal li.feature-list-item:hover {
  cursor: pointer;
}
.modal ul {
  padding-left: 0;
}

.close-button {
	float: right;
	cursor: pointer;
  font-size: 24px;
}

.feature-image {
	max-height: 300px;
	margin-bottom: 10px;
}
.tag-label {
	margin-top: 20px;
	display: block;
	font-weight: 700;
}
 
@media (max-width: 1100px) {
  .modal-content {
    max-height: calc(100vh - 280px);
  }
}
@media (max-width: 980px) { 
  .modal-content button + h3 {
    width: 100% !important;
    margin-top: 40px;
  }
  
  .modal-content {   
    max-height: calc(100vh - 440px);
    top: 150px;
    width: calc(100vw - 60px);
    right: auto;
    max-width: 100%;
    transform: none;
    left: 10px;
  }
}

</style>