<template>
  <div class="zoom-controls">
    <button class="zoom-button" @click="zoomIn" aria-label="Zoom in">+</button>
    <div class="zoom-slider-container">
      <div ref="zoomSlider" class="zoom-slider"></div>
    </div>
    <button class="zoom-button" @click="zoomOut" aria-label="Zoom out">−</button>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import noUiSlider from 'nouislider'
import 'nouislider/dist/nouislider.css'

export default {
  name: 'ZoomControls',
  props: {
    map: { type: Object, required: true }
  },
  setup(props) {
    const zoomSlider = ref(null)
    let slider = null

    function zoomIn() {
      if (props.map) {
        const newZoom = props.map.getZoom() + 1
        props.map.easeTo({ zoom: newZoom })
      }
    }

    function zoomOut() {
      if (props.map) {
        const newZoom = props.map.getZoom() - 1
        props.map.easeTo({ zoom: newZoom })
      }
    }

    function initializeSlider() {
      if (!zoomSlider.value || !props.map) return
      const minZoom = props.map.getMinZoom()
      const maxZoom = props.map.getMaxZoom()
      const currentZoom = props.map.getZoom()
      slider = noUiSlider.create(zoomSlider.value, {
        start: [currentZoom],
        orientation: 'vertical',
        direction: 'rtl',
        range: { min: minZoom, max: maxZoom },
        step: 0.5,
        tooltips: false
      })
      slider.on('slide', values => {
        const zoom = parseFloat(values[0])
        props.map.easeTo({ zoom })
      })
      props.map.on('zoom', () => {
        const currentZoom = props.map.getZoom()
        slider.set([currentZoom])
      })
    }

    function destroySlider() {
      if (slider) {
        slider.destroy()
        slider = null
      }
    }

    onMounted(() => {
      initializeSlider()
    })

    onBeforeUnmount(() => {
      destroySlider()
    })

    return { zoomSlider, zoomIn, zoomOut }
  }
}
</script>
<style scoped>
.zoom-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 16;
  display: flex;
  flex-direction: row;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  padding: 10px;
  border-radius: 4px;
  width: 80px;
  justify-content: center;
  border: 1px solid white;
}
.zoom-button {
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  color: white;
  font-size: 20px; 
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding:0;
  cursor:zoom-in
} 
.zoom-button:last-child {
  cursor:zoom-out
}
.zoom-button:hover {
  background: rgba(255, 255, 255, 0.1);
}
.zoom-slider-container {
  height: 100px;
  margin: 0 6px;
  display: flex;
  align-items: center;
}
.zoom-slider {
  width: 4px;
  height: 100%;
}
/* Custom noUiSlider rules for zoom control */
.zoom-slider :deep(.noUi-connects) {
  background-color: hsla(0,0%,100%,.3);
}
.zoom-slider.noUi-target {
	background-color: transparent;
}
.zoom-slider :deep(.noUi-connect) {
  background-color: white;
}
.zoom-slider :deep(.noUi-handle) {
  width: 18px;
  height: 18px;
  border-radius: 9px;
  background-color: white;
  box-shadow: none;
  border: none;
  right: -7px;
  cursor: row-resize;
}
.zoom-slider :deep(.noUi-handle:before),
.zoom-slider :deep(.noUi-handle:after) {
  display: none;
}
@media (max-width: 1150px) {
  .zoom-slider-container {
    display: none;
  }
  .zoom-controls {
    left: auto !important;
    right: 10px !important;
    bottom: 10px !important;
    top: auto;
    padding: 1.2px;
    position: fixed;
  }
}

</style>