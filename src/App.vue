<template>
  <div id="app">
    <PreloaderScreen v-if="showPreloader" @closePreloader="closePreloader" />

    <div ref="mapContainer" class="map-container"></div>

    <ZoomControls v-if="map" :map="map" />

    <div class="controls-container">
      <div class="top-controls">
        <Counter />
        <FiltersPanel @filtersUpdated="handleFiltersUpdate" />
      </div>
      <DateControls v-if="store.geojsonData" @dateRangeChanged="handleDateRangeChange" />
    </div>

    <Modal
      v-if="showModal"
      :currentFeatures="currentFeatures"
      :selectedFeature="selectedFeature"
      @closeModal="closeModal"
      @backToList="backToList"
      @update:selectedFeature="updateSelectedFeature"
    />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMapStore } from './stores/mapStore'
import mapboxgl from 'mapbox-gl'
import MapboxLanguage from '@mapbox/mapbox-gl-language'

import PreloaderScreen from './components/PreloaderScreen.vue'
import ZoomControls from './components/ZoomControls.vue'
import FiltersPanel from './components/FiltersPanel.vue'
import DateControls from './components/DateControls.vue'
import Modal from './components/Modal.vue'
import Counter from './components/Counter.vue'

export default {
  name: 'App',
  components: {
    PreloaderScreen,
    ZoomControls,
    FiltersPanel,
    DateControls,
    Modal,
    Counter
  },
  setup() {
    const store = useMapStore()
    const showPreloader = ref(true)
    const mapContainer = ref(null)
    const map = ref(null)
    const showModal = ref(false)
    const currentFeatures = ref([])
    const selectedFeature = ref(null)
    let hoveredFeatureId = null

    async function loadManifest() {
      try {
        const response = await fetch(`${import.meta.env.VITE_ASSETS_BASE_URL}/manifest.json`)
        if (!response.ok) throw new Error('Failed to fetch manifest')
        const manifest = await response.json()
        // Update your Pinia store with manifest data
        store.setManifestData(manifest)
      } catch (error) {
        console.error('Error loading manifest:', error)
      }
    }

    async function loadGeoJSONData() {
      try {
        // Use the latestGeojson file name from the manifest
        const geojsonFile = store.manifestData?.latestGeojson || 'default.geojson'
        const response = await fetch(`${import.meta.env.VITE_ASSETS_BASE_URL}/${geojsonFile}`)
        if (!response.ok) throw new Error('Failed to fetch GeoJSON')
        const data = await response.json()
        store.setGeojsonData(data)
      } catch (error) {
        console.error('Error loading GeoJSON:', error)
      }
    }

    async function initializeMap() {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;
      map.value = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: [96.712933, 62.917018],
        zoom: 5,
        renderWorldCopies: true
      })

      map.value.dragRotate.disable()
      map.value.touchZoomRotate.disableRotation()
      map.value.addControl(new MapboxLanguage({ defaultLanguage: 'ru' }))

      // Remove unwanted layers on first interaction
      let firstInteraction = true
      const handleInteraction = () => {
        if (firstInteraction) {
          firstInteraction = false
          const style = map.value.getStyle()
          if (!style || !style.layers) return
          style.layers.forEach(layer => {
            if (
              (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) ||
              layer.id.includes('label') ||
              layer.id.includes('boundary') ||
              layer.id.includes('admin') ||
              layer.id.includes('border')
            ) {
              if (map.value.getLayer(layer.id)) {
                map.value.removeLayer(layer.id)
              }
            }
          })
        }
      }
      map.value.on('movestart', handleInteraction)

      await new Promise(resolve => map.value.on('load', resolve))
      
      // Load the manifest first so we know which GeoJSON file to use
      await loadManifest()
      await loadGeoJSONData()
      await loadMarkerImages()
      setupMapLayers()
    }


    async function loadMarkerImages() {
      await Promise.all([
        loadImage('/custom-marker.png', 'custom-marker'),
        loadImage('/custom-marker-hover.png', 'custom-marker-hover')
      ])
    }

    function loadImage(url, name) {
      return new Promise((resolve, reject) => {
        map.value.loadImage(url, (error, image) => {
          if (error) reject(error)
          if (!map.value.hasImage(name)) {
            map.value.addImage(name, image)
          }
          resolve()
        })
      })
    }

    function setupMapLayers() {
      if (!map.value.getSource('features')) {
        map.value.addSource('features', {
          type: 'geojson',
          data: prepareGeoJSONForMarkers(store.filteredFeatures),
          generateId: true
        })

        // Normal markers
        map.value.addLayer({
          id: 'custom-markers',
          type: 'symbol',
          source: 'features',
          layout: {
            'icon-image': 'custom-marker',
            'icon-size': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              1, 0.5,
              3, 0.8,
              7, 1
            ],
            'icon-allow-overlap': true
          },
          paint: {
            'icon-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              0,
              0.4
            ]
          }
        })

        // Hover markers
        map.value.addLayer({
          id: 'custom-markers-hover',
          type: 'symbol',
          source: 'features',
          layout: {
            'icon-image': 'custom-marker-hover',
            'icon-size': 1.2,
            'icon-allow-overlap': true
          },
          paint: {
            'icon-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              1,
              0
            ]
          }
        })

        // Hover effect
        map.value.on('mousemove', 'custom-markers', (e) => {
          if (e.features.length > 0) {
            if (hoveredFeatureId !== null) {
              map.value.setFeatureState({ source: 'features', id: hoveredFeatureId }, { hover: false })
            }
            hoveredFeatureId = e.features[0].id
            map.value.setFeatureState({ source: 'features', id: hoveredFeatureId }, { hover: true })
            map.value.getCanvas().style.cursor = 'pointer'
          }
        })
        map.value.on('mouseleave', 'custom-markers', () => {
          if (hoveredFeatureId !== null) {
            map.value.setFeatureState({ source: 'features', id: hoveredFeatureId }, { hover: false })
          }
          hoveredFeatureId = null
          map.value.getCanvas().style.cursor = ''
        })

        // Attach a single click listener that queries rendered features in 'custom-markers'
        map.value.on('click', (e) => {
          const features = map.value.queryRenderedFeatures(e.point, { layers: ['custom-markers'] })
          if (features.length) {
            const groupedFeatures = JSON.parse(features[0].properties.features)
            showFeatureList(groupedFeatures)
          }
        })
      } else {
        const source = map.value.getSource('features')
        if (source) {
          source.setData(prepareGeoJSONForMarkers(store.filteredFeatures))
        }
      }
    }

    function prepareGeoJSONForMarkers(features) {
      const byCoord = {}
      features.forEach(f => {
        const coord = f.geometry.coordinates.join(',')
        if (!byCoord[coord]) byCoord[coord] = []
        byCoord[coord].push(f)
      })
      return {
        type: 'FeatureCollection',
        features: Object.entries(byCoord).map(([coord, groupedFeatures]) => {
          const [lng, lat] = coord.split(',').map(Number)
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
              point_count: groupedFeatures.length,
              features: JSON.stringify(groupedFeatures)
            }
          }
        })
      }
    }

    function showFeatureList(features) {
      currentFeatures.value = features
      selectedFeature.value = features.length === 1 ? features[0] : null
      showModal.value = true
    }

    function closeModal() {
      showModal.value = false
      selectedFeature.value = null
      currentFeatures.value = []
    }

    function backToList() {
      selectedFeature.value = null
    }

    function updateSelectedFeature(newFeature) {
      selectedFeature.value = newFeature
    }

    function closePreloader() {
      showPreloader.value = false
    }

    function handleFiltersUpdate(filters) {
      store.updateFilters(filters)
      setupMapLayers()
    }

    function handleDateRangeChange(dateRange) {
      store.updateDateRange(dateRange)
      setupMapLayers()
    }

    onMounted(() => {
      initializeMap()
    })

    onBeforeUnmount(() => {
      if (map.value) {
        map.value.remove()
      }
    })

    return {
      store,
      showPreloader,
      mapContainer,
      map,
      showModal,
      currentFeatures,
      selectedFeature,
      closePreloader,
      closeModal,
      backToList,
      updateSelectedFeature,
      handleFiltersUpdate,
      handleDateRangeChange
    }
  }
}
</script>

<style>
/* global.css */

/* Base resets and typography */
body {
  margin: 0 !important;
  font-family: 'Montserrat', sans-serif;
}

/* App layout */
#app {
  position: relative;
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.map-container {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}

/* Mapbox customizations */
.mapboxgl-canvas { 
  filter: contrast(140%) brightness(74%);
}
.mapboxgl-popup-content {
  background-color: #000009 !important;
  color: #ccc;
  padding-right: 30px;
  min-width: 222px;
  font-family: Arial, sans-serif;
  font-size: 14px;
}
.mapboxgl-popup-content h3 {
  margin-top: 0;
  font-size: 16px;
  color: #000;
}
.mapboxgl-popup-content p {
  margin: 5px 0;
}
.mapboxgl-popup-content button {
  margin-top: 10px;
  padding: 5px 10px;
  background-color: #51bbd6;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.mapboxgl-popup-content button:hover {
  background-color: #429ab8;
}
.mapboxgl-popup-close-button {
  background-color: transparent !important;
}
.mapboxgl-popup-content a {
  color: #ccc !important;
  display: block;
  padding-top: 20px !important;
}
.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
  border-top-color: #000009 !important;
}
.mapboxgl-ctrl-logo,
.mapboxgl-ctrl-attrib {
  display: none !important;
}
 

/* noUiSlider global rules */
.noUi-horizontal {
  height: 10px;
}
.noUi-horizontal .noUi-tooltip {
  font-size: 8px;
  background-color: black;
}
.noUi-marker-horizontal.noUi-marker {
  display: none;
}
.noUi-value-horizontal {
  font-size: 10px !important;
}
.noUi-horizontal .noUi-handle {
  background-color: black;
  height: 20px;
  box-shadow: none;
}
.noUi-connect {
  background-color: white;
}

/* Linkink hidden */
.Linkink {
  display: none;
}

/* Adjacent spacing for tag-label */
.tag-label + ul,
.tag-label + div {
  margin-top: 5px;
}
 </style>