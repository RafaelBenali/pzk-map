<template>
  <div @click="openModal" class="counter-wrap">
    <img src="/custom-marker-hover.png" alt="Marker" />
    <div class="counter">
      <span>{{ store.displayCount }}</span>
      <span style="display: block;">пзк</span>
    </div>
  </div>

  <div v-if="isModalOpen" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-button" @click="closeModal">&times;</button> 
        <p>
          Информация связа с сайта <a href="https://memopzk.org/" target="_blank" rel="noopener noreferrer"> Поддержка политзаключённых. Мемориал </a> 
        </p> 
        <p>
          Дата последнего обновления:  {{ latestUpdate }}
        </p>  
      </div>
    </div>
</template>

<script>
import { computed } from 'vue'
import { useMapStore } from '../stores/mapStore'

export default {
  name: 'Counter',
  setup() {
    const store = useMapStore();
    const latestUpdate = computed(() => store.manifestData?.latestUpdate || 'Not available');
    return { store, latestUpdate } 
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
}
.modal{
  z-index: 100;
}
@media (max-width: 980px) {
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