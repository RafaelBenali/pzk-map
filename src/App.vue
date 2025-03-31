<template>
  <div id="app">
    <PreloaderScreen v-if="showPreloader" @closePreloader="closePreloader" />

    <div ref="mapContainer" class="map-container"></div>

    <div class="controls-container">
      <ZoomControls v-if="map" :map="map" /> 

      <div class="top-controls">
        <Counter />
        <FiltersPanel @filtersUpdated="handleFiltersUpdate" />
      </div>

      <HowTo :preloaderClosed="!showPreloader" />

      <Letters />

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
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useMapStore } from './stores/mapStore'
import mapboxgl from 'mapbox-gl'
import MapboxLanguage from '@mapbox/mapbox-gl-language'
import { throttle } from 'lodash' // Added lodash throttle import

import PreloaderScreen from './components/PreloaderScreen.vue'
import ZoomControls from './components/ZoomControls.vue'
import HowTo from './components/HowTo.vue'
import Letters from './components/Letters.vue'
import FiltersPanel from './components/FiltersPanel.vue'
import DateControls from './components/DateControls.vue'
import Modal from './components/Modal.vue'
import Counter from './components/Counter.vue'
import 'mapbox-gl/dist/mapbox-gl.css';


export default {
  name: 'App',
  components: {
    PreloaderScreen,
    ZoomControls,
    FiltersPanel,
    DateControls,
    Modal,
    Counter,
    HowTo,
    Letters
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

    // NEW: Fallback coordinates storage for rf.geojson features.
    let fallbackCoordinates = []

    async function loadManifest() {
      try {
        const response = await fetch(`/manifest.json`)
        if (!response.ok) throw new Error('Failed to fetch manifest')
        const manifest = await response.json()
        store.setManifestData(manifest)
      } catch (error) {
        console.error('Error loading manifest:', error)
      }
    }

    async function loadGeoJSONData() {
      try {
        const geojsonFile = store.manifestData?.latestGeojson || 'list_841_14-02-2025.geojson'
        const response = await fetch('/list_899_30-03-2025.geojson')
        if (!response.ok) throw new Error('Failed to fetch GeoJSON')
        const data = await response.json()
        store.setGeojsonData(data)
      } catch (error) {
        console.error('Error loading GeoJSON:', error)
      }
    }

    async function loadFallbackGeoJSONData() {
      try {
        const response = await fetch(`rf.geojson`)
        if (!response.ok) throw new Error('Failed to fetch rf.geojson')
        const fallbackData = await response.json()
        fallbackCoordinates = fallbackData.features.map(f => f.geometry.coordinates)
      } catch (error) {
        console.error('Error loading fallback GeoJSON:', error)
      }
    }

    async function initializeMap() {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;
      map.value = new mapboxgl.Map({
        container: mapContainer.value,
        style: 'mapbox://styles/mapbox/navigation-night-v1',
        center: [96.712933, 62.917018],
        zoom: 6,
        renderWorldCopies: true
      })

      map.value.dragRotate.disable()
      map.value.touchZoomRotate.disableRotation()
      map.value.addControl(new MapboxLanguage({ defaultLanguage: 'ru' }))

      // Remove unwanted layers on first interaction
      let firstInteraction = true
      const handleInteraction = () => {
        if (firstInteraction) {
          firstInteraction = false;
          const style = map.value.getStyle();
          if (!style || !style.layers) return;
          style.layers.forEach(layer => {
            // Check only for symbol layers with a text field…
            if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
              // …and remove only layers related to countries.
              // This assumes that the relevant layer id or source-layer contains 'country'
              const layerId = layer.id ? layer.id.toLowerCase() : '';
              const sourceLayer = layer['source-layer'] ? layer['source-layer'].toLowerCase() : '';
              if (layerId.includes('country') || sourceLayer.includes('country')) {
                if (map.value.getLayer(layer.id)) {
                  map.value.removeLayer(layer.id);
                }
              }
            }
          });
        }
      };
      
      // Uncomment if you wish to trigger this on interaction
      map.value.on('movestart', handleInteraction)

      await new Promise(resolve => map.value.on('load', resolve))
      
      removeBorders();

      await loadManifest()
      await loadGeoJSONData()
      await loadFallbackGeoJSONData()
      await loadMarkerImages()
      setupMapLayers()

      // Recalculate clusters on zoom and move events with throttling
      map.value.on('moveend', throttledUpdateClusters)
      map.value.on('zoomend', throttledUpdateClusters)
    }

    // Throttled map update functions
    const throttledUpdateClusters = throttle(updateClusters, 200)
    const throttledSetupMapLayers = throttle(setupMapLayers, 200)

    watch(() => [store.dateRange.startDate, store.dateRange.endDate], () => {
      nextTick(() => {
        throttledUpdateClusters();
      });
    }, { deep: true });
    
    async function loadMarkerImages() {
      await Promise.all([
        loadImage('/custom-marker.png', 'custom-marker'),
        loadImage('/custom-marker-hover.png', 'custom-marker-hover')
      ])
    }
    
    function removeBorders() {
      const style = map.value.getStyle();
      if (!style || !style.layers) return;
      style.layers.forEach(layer => {
        const layerId = layer.id.toLowerCase();
        if (
          layerId.includes('boundary') ||
          layerId.includes('admin') ||
          layerId.includes('border')
        ) {
          if (map.value.getLayer(layer.id)) {
            map.value.removeLayer(layer.id);
          }
        }
      });
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
    
    function handleDateRangeChange(dateRange) {
      store.updateDateRange(dateRange);
      throttledSetupMapLayers();
      
      // Force map update if in playback mode
      if (store.playback.isPlaying) {
        throttledUpdateClusters();
      }
    }
    
    // A basic clustering function that groups features based on their screen position.
    // Adjust the `threshold` value as needed (e.g., 50 pixels).
    function clusterFeatures(features) {
      if (!map.value) return features
      const threshold = 0  // pixel distance threshold
      const clusters = []
      const visited = new Set()

      // Project all features into screen coordinates
      const projected = features.map(f => ({
        feature: f,
        point: map.value.project(f.geometry.coordinates)
      }))

      for (let i = 0; i < projected.length; i++) {
        if (visited.has(i)) continue
        const cluster = [projected[i].feature]
        visited.add(i)
        for (let j = i + 1; j < projected.length; j++) {
          if (visited.has(j)) continue
          const dx = projected[i].point.x - projected[j].point.x
          const dy = projected[i].point.y - projected[j].point.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < threshold) {
            cluster.push(projected[j].feature)
            visited.add(j)
          }
        }
        clusters.push(cluster)
      }
      return clusters
    }

    // Prepare a GeoJSON FeatureCollection with clusters.
    function prepareGeoJSONForMarkers(features) {
      let fallbackIndex = 0;
      // Apply fallback for rf features.
      features.forEach(f => {
        if (f.properties.geocodeStatus === 'rf' && fallbackCoordinates.length > fallbackIndex) {
          f.geometry.coordinates = fallbackCoordinates[fallbackIndex];
          fallbackIndex++;
        }
      });

      // Separate rf features from others.
      const rfFeatures = features.filter(f => f.properties.geocodeStatus === 'rf');
      const nonRfFeatures = features.filter(f => f.properties.geocodeStatus !== 'rf');

      // Process rf features.
      let rfMarkers = [];
      const currentZoom = map.value.getZoom();
      if (currentZoom < 6) {
        // When zoomed in (zoom level > 7), aggregate all rf features into one marker.
        if (rfFeatures.length) {
          const avgCoord = averageCoordinates(rfFeatures);
          rfMarkers.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: avgCoord },
            properties: {
              point_count: rfFeatures.length,
              features: JSON.stringify(rfFeatures)
            }
          });
        }
      } else {
        // When zoom level is 7 or below, cluster rf features by proximity.
        const clusters = clusterFeatures(rfFeatures);
        rfMarkers = clusters.map(cluster => {
          let coord;
          if (cluster.length === 1) {
            coord = cluster[0].geometry.coordinates;
          } else {
            coord = averageCoordinates(cluster);
          }
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coord },
            properties: {
              point_count: cluster.length,
              features: JSON.stringify(cluster)
            }
          };
        });
      }

      // Process non-rf features by grouping markers with identical coordinates.
      const nonRfGroups = {};
      nonRfFeatures.forEach(f => {
        const key = f.geometry.coordinates.join(',');
        if (!nonRfGroups[key]) nonRfGroups[key] = [];
        nonRfGroups[key].push(f);
      });
      const nonRfMarkers = Object.values(nonRfGroups).map(group => {
        let coord;
        if (group.length === 1) {
          coord = group[0].geometry.coordinates;
        } else {
          coord = averageCoordinates(group);
        }
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coord },
          properties: {
            point_count: group.length,
            features: JSON.stringify(group)
          }
        };
      });

      // Combine both rf and non-rf markers.
      const markers = [...rfMarkers, ...nonRfMarkers];
      return {
        type: 'FeatureCollection',
        features: markers
      };
    }

    function averageCoordinates(featuresArray) {
      let sumLng = 0, sumLat = 0;
      featuresArray.forEach(f => {
        sumLng += f.geometry.coordinates[0];
        sumLat += f.geometry.coordinates[1];
      });
      return [sumLng / featuresArray.length, sumLat / featuresArray.length];
    }


    // Update clusters on zoom/move changes.
    function updateClusters() {
      if (!map.value) return;
      const source = map.value.getSource('features');
      if (source) {
        // Force a re-evaluation of filtered features
        const currentFeatures = [...store.filteredFeatures]; // Create a copy to force reactivity
        source.setData(prepareGeoJSONForMarkers(currentFeatures));
      }
    }

    function setupMapLayers() {
      if (!map.value.getSource('features')) {
        map.value.addSource('features', {
          type: 'geojson',
          data: prepareGeoJSONForMarkers(store.filteredFeatures),
          generateId: true
        })

        // Marker layer using your custom marker icon.
        map.value.addLayer({
          id: 'custom-markers',
          type: 'symbol',
          source: 'features',
          layout: {
            'icon-image': 'custom-marker',
            // Scale up the icon based on the point_count.
            'icon-size': [
              'interpolate',
              ['linear'],
              ['get', 'point_count'],
              1, 0.4,
              3, 0.6,
              7, 0.8
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

        // Hover marker layer.
        map.value.addLayer({
          id: 'custom-markers-hover',
          type: 'symbol',
          source: 'features',
          layout: {
            'icon-image': 'custom-marker-hover',
            'icon-size': 1,
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

        // Hover effect.
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

        // Click handler: when a marker (or cluster) is clicked, open the modal with the aggregated features.
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
      throttledSetupMapLayers()
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

   
  },
}
</script>
<style>

/* global.css */ 
@font-face {
  font-family: 'Montserrat';
  src: url('./Montserrat-Regular.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

/* Base resets and typography */
body {
  margin: 0 !important;
  font-family: 'Montserrat', sans-serif;
}
*{
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
  bottom: 25px;
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


.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  z-index: 17;
}
.modal-content {
  background: #fff;
  padding: 20px; 
  overflow-y: auto;
  border-radius: 8px;
  width: 500px;
  position: relative;
  max-height: calc(100vh - 170px);
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
  max-width: 370px;
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
  font-size: 24px;
  position: absolute;
  right: 0;
  top: 0;
}
.modal-content button.back-button{
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


/* bars

#app {
	position: relative;
	height: calc(100vh - 4px);
	margin: 0;
	padding: 0;
	overflow: hidden;
	border: 2px solid white;
	width: calc(100vw - 4px);
}
.mapboxgl-canvas-container::before{
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  content: ' ';
  background: repeating-linear-gradient(
        90deg,
        #fff,        
        rgba(0,0,0,0) 4px,    
        rgba(0,0,0,0)  200px,    
        rgba(0,0,0,0) 20px    
      );
  z-index: 1;
} 


*/

  
@media (max-width: 1150px) { 
  .modal-content button + h3 {
    width: 100% !important;
    margin-top: 40px;
  }
  
  .modal-content {    
    top: 70px;
    width: calc(100vw - 60px);
    right: auto;
    max-width: 100%;
    transform: none;
    left: 10px;
  } 

  .modal-content button.back-button {
    position: relative;
    margin-top: 0;
    padding-left: 0;
    margin-bottom: 10px;
    width: calc(100vw - 90px);
    text-align: right;
    padding-top: 5px;
    padding-right: 0;
  }
}

 </style>