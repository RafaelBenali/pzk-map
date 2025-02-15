<template>
  <div class="counter-wrap">
    <img src="/custom-marker-hover.png" alt="Marker" />
    <div class="counter">
      <span>{{ store.displayCount }}</span>
      <span style="display: block;">пзк</span>
    </div>
  </div>
</template>

<script>
import { useMapStore } from '../stores/mapStore'

export default {
  name: 'Counter',
  setup() {
    const store = useMapStore()
    return { store }
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
  width: 75px;
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