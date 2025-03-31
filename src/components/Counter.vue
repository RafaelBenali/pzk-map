<template>
  <div @click="openModal" class="counter-wrap">
    <img src="/custom-marker-hover.png" alt="Marker" />
    <div class="counter"> 
      <template v-if="isDataLoaded">
        <span>{{ Math.floor(animatedCount) }}</span>
        <span style="display: block;">пзк</span>
      </template>
      <template v-else>
        <div class="spinner"></div>
      </template>
    </div>
  </div>

  <div v-if="isModalOpen" class="modal" @click.self="closeModal">
    <div class="modal-content">
      <button class="close-button" @click="closeModal">&times;</button> 
      <p>
        Информация связа с сайта 
        <a href="https://memopzk.org/" target="_blank" rel="noopener noreferrer">
          Поддержка политзаключённых. Мемориал
        </a> 
      </p> 
      <p>
        Дата последнего обновления: {{ latestUpdate }}
      </p>  
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { useMapStore } from '../stores/mapStore'

export default {
  name: 'Counter',
  setup() {
    const store = useMapStore();
    const latestUpdate = computed(() => store.manifestData?.latestUpdate || 'Not available');

    // Animated count for the display
    const animatedCount = ref(store.displayCount);

    // Computed property to determine if the data is loaded (assuming geojsonData is null until loaded)
    const isDataLoaded = computed(() => store.geojsonData !== null);

    // Watch for changes in the store's displayCount and animate if GraphMode is disabled
    watch(
      () => store.displayCount,
      (newVal) => {
        if (store.dateRange.isGraphMode) {
          animatedCount.value = newVal;
          return;
        }
        
        const start = animatedCount.value;
        const end = newVal;
        const duration = 1000; // animation duration in ms
        const startTime = performance.now();

        const animate = (time) => {
          const elapsed = time - startTime;
          if (elapsed < duration) {
            // Linear interpolation between start and end
            animatedCount.value = start + (end - start) * (elapsed / duration);
            requestAnimationFrame(animate);
          } else {
            animatedCount.value = end;
          }
        };

        requestAnimationFrame(animate);
      }
    );

    return { store, latestUpdate, animatedCount, isDataLoaded };
  },
  data() {
    return {
      isModalOpen: false
    }
  },
  methods: {
    openModal() {
      this.isModalOpen = true;
    },
    closeModal() {
      this.isModalOpen = false;
    }
  }
}
</script>
 

<style scoped>
.counter-wrap { 
  top: 10px; 
  left: 10px;
  z-index: 16;
  background-color: #000;
  border: 1px solid #fff;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  color: white;
  width: 74px;
  float: left;
  position: relative;
  cursor: help; 
}
.counter-wrap img {
  width: 30px;
  margin-right: 8px;
}
.counter {
  font-size: 18px;
  text-transform: uppercase;
  font-weight: bold;
  text-align: center;
  min-height: 45px;
}
.modal{
  z-index: 100;
}


.spinner{
	border: 4px solid #f3f3f3;
	border-top: 4px solid #000;
	border-radius: 50%;
	width: 10px;
	height: 10px;
	animation: spin-9bd91872 1s linear infinite;
  margin-top: 15px;
  margin-left: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 1150px) {
  .counter-wrap {
    right: 10px !important;
    left: auto !important;
    position: absolute;
    top: 10px;
  }
  .counter-wrap img {
    width: 25px;
  }
  .counter {
    font-size: 16px;
  }
}
</style>