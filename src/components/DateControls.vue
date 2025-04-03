<template>
  <div class="date-controls-container">
    <div class="date-slider-container">
      <div class="control-buttons-row">
        <!-- "Время" button -->
        <button class="control-button button-time"
                :class="{ active: store.dateRange.isGraphMode }"
                @click="toggleGraphMode">
          Время
        </button>
        <div v-show="store.dateRange.isGraphMode" class="controls-group">
          <div class="filter-checkbox">
            <input type="checkbox" checked disabled />
            <span>Есть данные</span>
          </div>
          <div class="date-range-slider-container">
            <div ref="dateRangeSlider" class="date-range-slider"></div>
          </div>
          <div class="playback-slider-container">
            <div ref="playbackSlider" class="playback-slider"></div>
          </div>
        </div>
      </div>
      <div v-if="store.dateRange.isGraphMode" class="stats-group">
        <div class="date-stats">
          {{ formattedStartDate }} - {{ formattedEndDate }}
        </div>
      </div>
      <!-- Histogram wrapper -->
      <div v-if="store.dateRange.isGraphMode" class="histogram-wrapper" ref="histogramWrapper" @scroll="handleScroll">
        <div class="histogram-scroll-container">
          <!-- Histogram container: clicking uses fixed bar width -->
          <div class="histogram-container" ref="histogramContainer" @click="containerClick">
            <!-- Range Selection Overlay -->
            <div v-if="showRangeOverlay"
                 class="range-selection-overlay"
                 :style="rangeOverlayStyle"
                 @mousedown.prevent="startRangeDrag">
            </div>
            <!-- Render each bar -->
            <div v-for="(month, index) in store.monthlyData" :key="month.date"
                 class="histogram-bar"
                 :class="{
                   active: isMonthActive(month),
                   'in-range': isInCurrentRange(month),
                   inactive: isFutureMonth(month)
                 }"
                 :style="{ height: getBarHeight(month), opacity: getBarOpacity(month) }"
                 @click.stop="directBarClick(month)"
                 @mouseenter="showMonthTooltip($event, month)"
                 @mouseleave="hideTooltip">
            </div>
          </div>
          <div class="year-labels">
            <div v-for="yearLabel in computedYearLabels"
                 :key="yearLabel.year"
                 class="year-label"
                 :style="{ left: yearLabel.left }"
                 :class="{ highlighted: isYearInRange(yearLabel.year) }"
                 @click.stop="handleYearClick(yearLabel.year)"
                 @mouseenter="showYearTooltip($event, yearLabel)"
                 @mouseleave="hideTooltip">
              {{ yearLabel.year }}
            </div>
          </div>
        </div>
        <!-- Tooltip element -->
        <div v-if="tooltipData" class="histogram-tooltip" :style="tooltipStyle">
          <div>{{ tooltipData.label }}</div>
          <div>Количество: {{ tooltipData.count }}</div>
        </div>
      </div>
      <!-- Custom scrollbar -->
      <div v-if="store.dateRange.isGraphMode" class="custom-scrollbar-container" @click="handleScrollbarClick">
        <div class="custom-scrollbar" :style="customScrollbarStyle" @mousedown.prevent="startScrollbarDrag"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useMapStore } from '../stores/mapStore';
import noUiSlider from 'nouislider';
import { throttle } from 'lodash'; // Add lodash throttle import
import 'nouislider/dist/nouislider.css';

export default {
  name: 'DateControls',
  emits: ['dateRangeChanged'],
  setup(props, { emit }) {
    /* ====================================================
       1. References & Reactive State
    ====================================================== */
    const store = useMapStore();
    const dateRangeSlider = ref(null);
    const playbackSlider = ref(null);
    const histogramWrapper = ref(null);
    const histogramContainer = ref(null);
    const tooltipData = ref(null);
    const tooltipStyle = ref(null);
    const isDragging = ref(false);
    const isScrollbarDragging = ref(false);
    const dragStartX = ref(null);
    const lastSliderValue = ref(null);
    const scrollPosition = ref(0);
    // Flag indicating a boundary has been reached
    const hasReachedLimit = ref(false);
    const allowedValues = [-3, -2, -1, 0, 1, 2, 3];
    const BAR_TOTAL_WIDTH = 7;
    // For full‑range mode playback:
    const isFullRangeExpandingPlayback = ref(false);
    const initialPlaybackDirection = ref(0);
    // In full‑range mode started with positive speed, the overlay remains locked on.
    const lockedPositivePlayback = ref(false);
    // Flag indicating that playback started while full‑range was selected.
    const startedWithFullRange = ref(false);
    // Flag to track transition from full range to non-full range
    const transitionedFromFullRange = ref(false);
    // New flags to fix pause/resume issues
    const wasPausedInFullRange = ref(false);
    const pausedFullRangeDirection = ref(0);
    const pausedPlaybackState = ref({});
    let playbackInterval = null;

    // Helper: compute the difference in months between two dates
    function monthDiff(d1, d2) {
      return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    }

    /* ====================================================
       2. Computed Properties
    ====================================================== */
    const computedYearLabels = computed(() => {
      const labels = [];
      store.monthlyData.forEach((month, index) => {
        if (index === 0 || month.year !== store.monthlyData[index - 1].year) {
          labels.push({ year: month.year, left: index * BAR_TOTAL_WIDTH + 'px' });
        }
      });
      return labels;
    });
    
    const customScrollbarStyle = computed(() => {
      if (!histogramWrapper.value || !store.dateRange.isGraphMode)
        return { left: '0px', width: '50px' };
      const container = histogramWrapper.value;
      const totalWidth = container.scrollWidth;
      const viewportWidth = container.clientWidth;
      if (totalWidth <= viewportWidth)
        return { width: '100%', left: '0px' };
      const thumbWidth = Math.max(50, (viewportWidth / totalWidth) * viewportWidth);
      const maxScroll = totalWidth - viewportWidth;
      const ratio = scrollPosition.value / maxScroll;
      const leftPosition = (viewportWidth - thumbWidth) * ratio;
      return { width: thumbWidth + 'px', left: leftPosition + 'px' };
    });
    
    const formattedStartDate = computed(() =>
      store.dateRange.startDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' }).replace(' г.', '')
    );
    const formattedEndDate = computed(() =>
      store.dateRange.endDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' }).replace(' г.', '')
    );
    
    // Overlay: In full‑range mode started with negative speed, the overlay is always off.
    const showRangeOverlay = computed(() => {
      if (!store.dateRange.isGraphMode) return false;
      if (startedWithFullRange.value && initialPlaybackDirection.value < 0) return false;
      if (!isAllRangeSelected()) return true;
      return lockedPositivePlayback.value;
    });
    
    const rangeOverlayStyle = computed(() => {
      if (!store.dateRange.startDate || !store.dateRange.endDate)
        return { display: 'none' };
      if (isAllRangeSelected() && lockedPositivePlayback.value && isFullRangeExpandingPlayback.value) {
        const offset = 0;
        const endMonth = monthDiff(store.effectiveFullRangeStart, store.dateRange.endDate) + 1;
        return { left: offset * BAR_TOTAL_WIDTH + 'px', width: endMonth * BAR_TOTAL_WIDTH + 'px' };
      } else {
        const offset = monthDiff(store.effectiveFullRangeStart, store.dateRange.startDate);
        const diff = monthDiff(store.dateRange.startDate, store.dateRange.endDate) + 1;
        return { left: offset * BAR_TOTAL_WIDTH + 'px', width: diff * BAR_TOTAL_WIDTH + 'px' };
      }
    });
    
    /* ====================================================
       3. Utility Functions
    ====================================================== */
    function isAllRangeSelected() {
      return store.dateRange.selectedRangeMonths === store.totalMonths;
    }
    
    function isMonthActive(month) {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth());
      const monthDate = new Date(month.year, month.month);
      return monthDate <= currentMonthStart;
    }
    
    function isFutureMonth(month) {
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth());
      const monthDate = new Date(month.year, month.month);
      return monthDate > currentMonthStart;
    }
    
    function isInCurrentRange(month) {
      if (!store.dateRange.isGraphMode) return true;
      if (!store.dateRange.startDate || !store.dateRange.endDate) return true;
      const mDate = new Date(month.year, month.month);
      const start = new Date(store.dateRange.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(store.dateRange.endDate); end.setHours(23, 59, 59, 999);
      return mDate >= start && mDate <= end;
    }
    
    function getBarOpacity(month) {
      return isInCurrentRange(month) ? 1 : 0.3;
    }
    
    function getBarHeight(month) {
      return store.maxCount > 0 ? (month.count / store.maxCount) * 100 + '%' : '0%';
    }
    
    function isYearInRange(year) {
      if (!store.dateRange.isGraphMode) return false;
      if (!store.dateRange.startDate || !store.dateRange.endDate) return false;
      const yStart = new Date(year, 0, 1);
      const yEnd = new Date(year, 11, 31);
      return (
        (store.dateRange.startDate >= yStart && store.dateRange.startDate <= yEnd) ||
        (store.dateRange.endDate >= yStart && store.dateRange.endDate <= yEnd) ||
        (store.dateRange.startDate <= yStart && store.dateRange.endDate >= yEnd)
      );
    }
    
    /* ====================================================
       4. Slider Initialization & Destruction
    ====================================================== */
    function initializeDateRangeSlider() {
      const el = dateRangeSlider.value;
      if (!el) return;
      if (el.noUiSlider) el.noUiSlider.destroy();
      const maxMonths = store.totalMonths;
      const format = {
        to: v => {
          const m = parseInt(v);
          if (m === maxMonths)
            return '2000 - ' + store.fullRangeEnd.getFullYear();
          if (m <= 6) return m + 'м';
          if (m === 12) return '1г'; 
          if (m === 24) return '2г';
          if (m === 36) return '3г';
          if (m === 60) return '5л'; 
          return m + 'м';
        },
        from: () => {}
      };
      noUiSlider.create(el, {
        start: [store.dateRange.selectedRangeMonths || maxMonths],
        connect: [true, false],
        direction: 'rtl',
        snap: true,
        range: {
          min: [1],
          '10%': [2],
          '15%': [3],
          '20%': [4],
          '25%': [5],
          '30%': [6],
          '45%': [12], 
          '60%': [24],
          '68%': [36],
          '75%': [60], 
          max: [maxMonths]
        },
        step: 1,
        tooltips: [format],
        pips: {
          mode: 'values',
          values: [maxMonths, 60, 24, 12, 6, 3, 1],
          format,
          density: 4
        }
      });
      
      el.noUiSlider.on('update', values => {
        const m = Math.round(parseFloat(values[0]));
        if (lastSliderValue.value !== m) {
          lastSliderValue.value = m;
          pausePlayback(true); // Hard reset playback when changing range
          isFullRangeExpandingPlayback.value = false;
          lockedPositivePlayback.value = false;
          initialPlaybackDirection.value = 0;
          wasPausedInFullRange.value = false;
          
          // Check if we're transitioning from full range to non-full range
          const isTransitioning = isAllRangeSelected() && m !== store.totalMonths;
          
          store.updateDateRange({ selectedRangeMonths: m });
          const currentRange = calculateRangeForMonths(m);
          store.updateDateRange({
            startDate: currentRange.startDate,
            endDate: currentRange.endDate,
            selectedRangeMonths: m
          });
          
          // Set the flag if we're transitioning from full range to non-full range
          if (isTransitioning) {
            transitionedFromFullRange.value = true;
          }
          
          nextTick(() => {
            store.updateDisplayCount();
            store.updateMonthlyData();
            scrollToCurrentRange();
            emitDateRangeChanged();
          });
        }
      });
      
      el.querySelectorAll('.noUi-value').forEach(pip => {
        pip.style.cursor = 'pointer';
        pip.addEventListener('click', e => {
          const txt = e.target.innerText;
          let m = maxMonths;
          if (txt.includes('2000')) { // Full range pip
            // Always handle the full-range pip click, regardless of play state
            pausePlayback(true); // Hard reset when switching to full range
            isFullRangeExpandingPlayback.value = false;
            startedWithFullRange.value = false;
            lockedPositivePlayback.value = false;
            initialPlaybackDirection.value = 0;
            wasPausedInFullRange.value = false;
            store.updateDateRange({
              startDate: new Date(store.fullRangeStart),
              endDate: new Date(store.fullRangeEnd),
              selectedRangeMonths: maxMonths
            });
            el.noUiSlider.set(maxMonths);
            nextTick(() => {
              store.updateDisplayCount();
              store.updateMonthlyData();
              scrollHistogramToEnd();
            });
            return;
          }
          pausePlayback(true); // Hard reset when changing range
          isFullRangeExpandingPlayback.value = false;
          wasPausedInFullRange.value = false;
          if (txt.includes('10л')) m = 120;
          else if (txt.includes('5л')) m = 60;
          else if (txt.includes('3г')) m = 36;
          else if (txt.includes('2г')) m = 24;
          else if (txt.includes('1.5г')) m = 18;
          else if (txt.includes('1г')) m = 12;
          else if (txt.includes('6м')) m = 6;
          else if (txt.includes('3м')) m = 3;
          else if (txt.includes('1м')) m = 1;
          
          // Check if we're transitioning from full range to non-full range
          const isTransitioning = isAllRangeSelected() && m !== maxMonths;
          if (isTransitioning) {
            transitionedFromFullRange.value = true;
          }
          
          el.noUiSlider.set(m);
        });
      });
    }
    
    function initializePlaybackSlider() {
    const el = playbackSlider.value;
    if (!el) return;
    if (el.noUiSlider) el.noUiSlider.destroy();
    const startIndex = allowedValues.indexOf(0);
    
    // Flag to prevent recursive event handling
    let isHandlingEvent = false;
    
    noUiSlider.create(el, {
      start: [startIndex],
      range: { min: 0, max: 6 },
      step: 1,
      tooltips: false,
      pips: {
        mode: 'values',
        values: [0, 1, 2, 3, 4, 5, 6],
        format: {
          to: v => {
            const spd = allowedValues[v];
            return spd === 0 ? 'Пауза' : spd + 'x';
          }
        },
        density: 10
      }
    });
    
    // Use a single event handler function to prevent recursion
    function handleSliderChange(values) {
      // Prevent recursive calls
      if (isHandlingEvent) return;
      
      try {
        isHandlingEvent = true;
        const idx = parseInt(values[0]);
        const spd = allowedValues[idx];
        
        // CRITICAL FIX: For pause pip, directly call pausePlayback
        if (spd === 0) {
          pausePlayback(false);
        } else {
          setPlaybackSpeedAndDirection(spd);
        }
      } finally {
        // Always reset the flag even if an error occurs
        setTimeout(() => {
          isHandlingEvent = false;
        }, 50); // Small delay to ensure events don't overlap
      }
    }
    
    // Use throttled version for continuous updates during drag
    const throttledHandler = throttle(handleSliderChange, 200);
    
    // Only use 'set' event (when user releases the slider)
    // This avoids the recursion problem while keeping responsive control
    el.noUiSlider.on('set', handleSliderChange);
    
    // Handle pip clicks (these work correctly)
    el.querySelectorAll('.noUi-value').forEach(pip => {
      pip.style.cursor = 'pointer';
      pip.addEventListener('click', e => {
        // Clear any potential pending handlers
        isHandlingEvent = false;
        
        const txt = e.target.innerText;
        if (txt === 'Пауза') {
          // Set slider to 0 position
          el.noUiSlider.set(allowedValues.indexOf(0));
          // Directly call pausePlayback to ensure it happens
          pausePlayback(false);
          return;
        }
        const spd = parseInt(txt.replace('x', ''));
        const idx = allowedValues.indexOf(spd);
        if (idx !== -1) {
          el.noUiSlider.set(idx);
        } 
      });
    });
  }
    
    function destroySliders() {
      if (dateRangeSlider.value?.noUiSlider) dateRangeSlider.value.noUiSlider.destroy();
      if (playbackSlider.value?.noUiSlider) playbackSlider.value.noUiSlider.destroy();
    }
    
    /* ====================================================
       5. Playback Control Functions
    ====================================================== */
    function updatePlaybackInterval() {
      destroyPlaybackInterval();
      if (!store.playback.isPlaying) return;
      const intervalMs = 1000 / store.playback.speed;
      const step = store.playback.isPlayingBackwards ? -1 : 1;
      playbackInterval = setInterval(() => {
        moveRange(step);
        // Force update counts after each move
        nextTick(() => {
          store.updateDisplayCount();
          store.updateMonthlyData();
        });
      }, intervalMs);
    }
    
    function destroyPlaybackInterval() {
      if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
      }
    }
    
    function pausePlayback(hardReset = false) {
    // Completely stop playback interval first
    destroyPlaybackInterval();
    
    // CRITICAL: Save full range playback state before pausing
    if (startedWithFullRange.value && !hardReset) {
      wasPausedInFullRange.value = true;
      pausedFullRangeDirection.value = initialPlaybackDirection.value;
      
      // Store COMPLETE state information - DEEP COPY all dates and values
      pausedPlaybackState.value = {
        wasExpandingPlayback: isFullRangeExpandingPlayback.value,
        wasLockedPositive: lockedPositivePlayback.value,
        wasPlayingBackwards: store.playback.isPlayingBackwards,
        wasSpeed: store.playback.speed,
        wasStartDate: new Date(store.dateRange.startDate),
        wasEndDate: new Date(store.dateRange.endDate),
        wasSelectedRangeMonths: store.dateRange.selectedRangeMonths,
        // Add the entire current range state
        wasIsAllRangeSelected: isAllRangeSelected(),
        wasGraphMode: store.dateRange.isGraphMode
      };
    } else if (hardReset) {
      // Hard reset clears ALL flags and state
      wasPausedInFullRange.value = false;
      pausedFullRangeDirection.value = 0;
      pausedPlaybackState.value = {};
      hasReachedLimit.value = false;
      lockedPositivePlayback.value = false;
      initialPlaybackDirection.value = 0;
      startedWithFullRange.value = false;
      isFullRangeExpandingPlayback.value = false;
    }
    
    // Update playback state in the store
    store.updatePlaybackState({
      isPlaying: false,
      isPlayingBackwards: store.playback.isPlayingBackwards,
      isPaused: true,
      speed: 1
    });
    
    // Only reset state flags on hard reset, otherwise preserve them
    if (hardReset) {
      lockedPositivePlayback.value = false;
      initialPlaybackDirection.value = 0;
      startedWithFullRange.value = false;
      isFullRangeExpandingPlayback.value = false;
    }
    
    // Set slider to pause position
    if (playbackSlider.value?.noUiSlider) {
      playbackSlider.value.noUiSlider.set(allowedValues.indexOf(0));
    }
  }
    
  function setPlaybackSpeedAndDirection(speed) {
  // If speed is zero, always pause
  if (speed === 0) {
    pausePlayback(false); // Use non-hard pause to preserve state
    return;
  }
  
  // CRITICAL FIX: Check if we have to wrap-around BEFORE checking if we're resuming
  if (hasReachedLimit.value) {
    handleWrapAround(speed);
    return;
  }
  
  // ===== SECTION 1: RESUMING FROM PAUSE IN FULL RANGE MODE =====
  if (!store.playback.isPlaying && wasPausedInFullRange.value) {
    console.log("Resuming from pause in full range mode");
    
    // CRITICAL: PRESERVE the original initial direction
    initialPlaybackDirection.value = pausedFullRangeDirection.value;
    startedWithFullRange.value = true;
    
    // CRITICAL: Handle differently based on ORIGINAL direction
    if (pausedFullRangeDirection.value > 0) {
      // FOR POSITIVE MODE: Always ensure overlay and first date locked
      const effMin = new Date(store.effectiveFullRangeStart);
      lockedPositivePlayback.value = true;
      isFullRangeExpandingPlayback.value = pausedPlaybackState.value.wasExpandingPlayback;
      
      // CRITICAL: Always restore with first date locked to beginning
      store.updateDateRange({
        startDate: new Date(effMin), // LOCK first date to beginning
        endDate: new Date(pausedPlaybackState.value.wasEndDate),
        selectedRangeMonths: monthDiff(effMin, new Date(pausedPlaybackState.value.wasEndDate)) + 1
      });
    } else {
      // FOR NEGATIVE MODE: Never show overlay, exact state restoration
      lockedPositivePlayback.value = false; // NEVER show overlay for negative
      isFullRangeExpandingPlayback.value = false;
      
      // Restore exactly as saved
      store.updateDateRange({
        startDate: new Date(pausedPlaybackState.value.wasStartDate),
        endDate: new Date(pausedPlaybackState.value.wasEndDate),
        selectedRangeMonths: pausedPlaybackState.value.wasSelectedRangeMonths
      });
    }
    
    // Update playback state and resume
    store.updatePlaybackState({
      isPaused: false,
      speed: Math.abs(speed),
      isPlaying: true,
      isPlayingBackwards: speed < 0,
      lastNonZeroIndex: allowedValues.indexOf(speed)
    });
    
    wasPausedInFullRange.value = false; // Reset this flag
    updatePlaybackInterval();
    return;
  }
  
  // ===== SECTION 2: STARTING NEW PLAYBACK =====
  if (!store.playback.isPlaying) {
    // Full range mode logic
    if (isAllRangeSelected()) {
      if (speed > 0) {
        // Starting positive full-range playback
        const effMin = new Date(store.effectiveFullRangeStart);
        const startDate = new Date(effMin);
        const endDate = new Date(startDate); // Same date to start
        
        // Set up flags
        lockedPositivePlayback.value = true;
        initialPlaybackDirection.value = speed;
        startedWithFullRange.value = true;
        isFullRangeExpandingPlayback.value = true;
        wasPausedInFullRange.value = false;
        
        // Set initial range
        store.updateDateRange({
          startDate: startDate,
          endDate: endDate,
          selectedRangeMonths: 1
        });
        
        // Start playback
        store.updatePlaybackState({
          isPaused: false,
          speed: Math.abs(speed),
          isPlaying: true,
          isPlayingBackwards: false,
          lastNonZeroIndex: allowedValues.indexOf(speed)
        });
        
        // Scroll to beginning
        scrollHistogramToBeginning();
        
        // Force immediate first expansion
        nextTick(() => {
          store.updateDisplayCount();
          store.updateMonthlyData();
          // Immediate first move
          moveFullRange(1);
        });
        
        // Set up interval for subsequent moves
        updatePlaybackInterval();
        return;
      } else {
        // Starting negative full-range playback
        lockedPositivePlayback.value = false; // NEVER show overlay for negative
        initialPlaybackDirection.value = speed;
        startedWithFullRange.value = true;
        isFullRangeExpandingPlayback.value = false;
        wasPausedInFullRange.value = false;
        
        // Leave at full range initially
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        
        // Scroll to end
        scrollHistogramToEnd();
      }
    } else {
      // Starting normal range playback
      initialPlaybackDirection.value = speed;
      startedWithFullRange.value = false;
      wasPausedInFullRange.value = false;
    }
    
    // Set playback state (except for positive full-range which is handled separately)
    if (!(isAllRangeSelected() && speed > 0)) {
      store.updatePlaybackState({
        isPaused: false,
        speed: Math.abs(speed),
        isPlaying: true,
        isPlayingBackwards: speed < 0,
        lastNonZeroIndex: allowedValues.indexOf(speed)
      });
      updatePlaybackInterval();
    }
  } 
  // ===== SECTION 3: CHANGING SPEED DURING PLAYBACK =====
  else if (store.playback.isPlaying) {
    // If we're in full-range mode, preserve overlay state based on INITIAL direction
    if (startedWithFullRange.value) {
      // CRITICAL: Never change lockedPositivePlayback - depends ONLY on initial direction
      if (initialPlaybackDirection.value > 0) {
        // Started positive, ALWAYS keep overlay regardless of current direction
        lockedPositivePlayback.value = true;
      } else if (initialPlaybackDirection.value < 0) {
        // Started negative, NEVER show overlay regardless of current direction
        lockedPositivePlayback.value = false;
      }
    }
    
    // Just update the playback state without changing other flags
    store.updatePlaybackState({
      isPaused: false,
      speed: Math.abs(speed),
      isPlaying: true,
      isPlayingBackwards: speed < 0,
      lastNonZeroIndex: allowedValues.indexOf(speed)
    });
    updatePlaybackInterval();
  }
}
    
    // Completely rewritten wrap-around handler to fix the full-range mode issues
    function handleWrapAround(speed) {
      // Handling wrap-around
      
      hasReachedLimit.value = false; // Clear the limit flag immediately
      
      // Full range mode wrap-around
      if (startedWithFullRange.value) {
        // CRITICAL FIX: Remember the original initial direction before making any changes
        const originalDirection = initialPlaybackDirection.value;
        
        // Full range wrap-around
        
        // First, reset to full range
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        
        // Check if the slider was moved to opposite direction or same direction
        const isDirectionChange = (originalDirection > 0 && speed < 0) || (originalDirection < 0 && speed > 0);
        
        // Start new playback with the requested direction
        if (speed > 0) {
          // Starting positive wrap-around
          // ALWAYS start from beginning for positive wrap-around
          const startDate = new Date(store.effectiveFullRangeStart);
          const endDate = new Date(startDate); // Same date to start
          
          // CRITICAL: Set initial direction to the new speed
          initialPlaybackDirection.value = speed;
          startedWithFullRange.value = true;
          
          // Always enable expansion and overlay for positive initial direction
          isFullRangeExpandingPlayback.value = true;
          lockedPositivePlayback.value = true;
          wasPausedInFullRange.value = false;
          
          // Set initial range
          store.updateDateRange({
            startDate: startDate,
            endDate: endDate,
            selectedRangeMonths: 1
          });
          
          // Start playback
          store.updatePlaybackState({
            isPaused: false,
            speed: Math.abs(speed),
            isPlaying: true,
            isPlayingBackwards: false,
            lastNonZeroIndex: allowedValues.indexOf(speed)
          });
          
          // Scroll to beginning
          scrollHistogramToBeginning();
          
          // Force immediate first expansion
          nextTick(() => {
            store.updateDisplayCount();
            store.updateMonthlyData();
            // Immediate first move
            moveFullRange(1);
          });
        } else {
          // Starting negative wrap-around
          // For negative wrap-around, start fresh from full range
          
          // CRITICAL: Set initial direction to the new speed
          initialPlaybackDirection.value = speed;
          startedWithFullRange.value = true;
          
          // Never show overlay for negative initial direction
          isFullRangeExpandingPlayback.value = false;
          lockedPositivePlayback.value = false;
          wasPausedInFullRange.value = false;
          
          // Setup starting from full range with negative direction
          store.updateDateRange({
            startDate: new Date(store.fullRangeStart),
            endDate: new Date(store.fullRangeEnd),
            selectedRangeMonths: store.totalMonths
          });
          
          // Start playback
          store.updatePlaybackState({
            isPaused: false,
            speed: Math.abs(speed),
            isPlaying: true,
            isPlayingBackwards: true,
            lastNonZeroIndex: allowedValues.indexOf(speed)
          });
          
          // Scroll to end
          scrollHistogramToEnd();
          
          // Force update before starting the interval
          nextTick(() => {
            store.updateDisplayCount();
            store.updateMonthlyData();
          });
        }
        
        // Start the playback interval in both cases
        updatePlaybackInterval();
      } 
      // Normal range wrap-around
      else {
        // Normal range wrap-around
        const rangeMonths = store.dateRange.selectedRangeMonths;
        const now = new Date();
        const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const allowedMaxNonFull = currentMonthLastDay < store.effectiveFullRangeEnd ? currentMonthLastDay : store.effectiveFullRangeEnd;
        const effMin = new Date(store.effectiveFullRangeStart);
        
        // If we're wrapped at the end, go to beginning
        if (speed > 0) {
          const newStart = new Date(effMin);
          const newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + rangeMonths, 0);
          store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
        } 
        // If we're wrapped at the beginning, go to end
        else {
          const newEnd = new Date(allowedMaxNonFull);
          const newStart = new Date(newEnd.getFullYear(), newEnd.getMonth() - rangeMonths + 1, 1);
          store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
        }
        
        // Start playback with the new direction
        store.updatePlaybackState({
          isPaused: false,
          speed: Math.abs(speed),
          isPlaying: true,
          isPlayingBackwards: speed < 0,
          lastNonZeroIndex: allowedValues.indexOf(speed)
        });
        
        // Scroll to the new position
        scrollToCurrentRange();
        
        // Update interval for continued playback
        updatePlaybackInterval();
      }
    }
    
    // ---------------------------
    // Move range functions:
    // ---------------------------
    
    // Non‑Full‑Range Mode move:
    function moveNonFullRange(step) {
      // Force update counts at end of each move
      const updateCounts = () => {
        nextTick(() => {
          store.updateDisplayCount();
          store.updateMonthlyData();
        });
      };
      
      const rangeMonths = store.dateRange.selectedRangeMonths;
      const currentStart = store.dateRange.startDate;
      const currentEnd = store.dateRange.endDate;
      // In non-full mode, allowed maximum is the minimum of current month's last day and effective end.
      const now = new Date();
      const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const allowedMaxNonFull = currentMonthLastDay < store.effectiveFullRangeEnd ? currentMonthLastDay : store.effectiveFullRangeEnd;
      const effMin = new Date(store.effectiveFullRangeStart);

      if (step > 0) {
        // If we're at or beyond the right boundary, check if we should wrap-around immediately
        if (currentEnd.getTime() >= allowedMaxNonFull.getTime()) {
          // If transitionedFromFullRange is true, wrap-around immediately
          if (transitionedFromFullRange.value) {
            transitionedFromFullRange.value = false; // Reset the flag
            let newStart = new Date(effMin);
            let newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + rangeMonths, 0);
            store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
            scrollToCurrentRange();
            updateCounts();
            return;
          }
          // Otherwise, pause playback
          hasReachedLimit.value = true;
          pausePlayback();
          updateCounts();
          return;
        }
        // Otherwise, shift normally.
        let newStart = new Date(currentStart);
        newStart.setMonth(newStart.getMonth() + step);
        newStart = new Date(newStart.getFullYear(), newStart.getMonth(), 1);
        let newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + rangeMonths, 0);
        if (newEnd.getTime() > allowedMaxNonFull.getTime()) {
          newEnd = allowedMaxNonFull;
          store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
          hasReachedLimit.value = true;
          pausePlayback();
          updateCounts();
          return;
        }
        store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
        scrollToCurrentRange();
        updateCounts();
      } else if (step < 0) {
        // For negative playback: if we're at or beyond the left boundary, check if we should wrap-around
        if (currentStart.getTime() <= effMin.getTime()) {
          // If transitionedFromFullRange is true, wrap-around immediately
          if (transitionedFromFullRange.value) {
            transitionedFromFullRange.value = false; // Reset the flag
            // Wrap-around: jump to the right boundary.
            let newEnd = new Date(allowedMaxNonFull);
            let newStart = new Date(newEnd.getFullYear(), newEnd.getMonth() - rangeMonths + 1, 1);
            store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
            scrollToCurrentRange();
            updateCounts();
            return;
          }
          // Otherwise, pause playback
          hasReachedLimit.value = true;
          pausePlayback();
          updateCounts();
          return;
        }
        let newStart = new Date(currentStart);
        newStart.setMonth(newStart.getMonth() + step);
        newStart = new Date(newStart.getFullYear(), newStart.getMonth(), 1);
        let newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + rangeMonths, 0);
        if (newStart.getTime() < effMin.getTime()) {
          newStart = effMin;
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + rangeMonths, 0);
          store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
          hasReachedLimit.value = true;
          pausePlayback();
          updateCounts();
          return;
        }
        store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
        scrollToCurrentRange();
        updateCounts();
        emitDateRangeChanged();
      }
    }
    
    // Completely rewritten moveFullRange function to fix overlay and position issues
    function moveFullRange(step) {
  // Moving range in full range mode
  const effMin = new Date(store.effectiveFullRangeStart);
  // In full‑range mode, use the full-range end.
  const allowedMaxFR = store.fullRangeEnd;
  
  // CRITICAL: Base behavior on INITIAL direction, not current step
  if (initialPlaybackDirection.value > 0) {
    // For positive initial direction: ALWAYS lock first date to beginning
    if (step > 0) {
      // Positive initial + positive step: expand end date
      const currentEnd = new Date(store.dateRange.endDate);
      let newEnd;
      
      // Create a new date at the first of the next month
      if (currentEnd.getMonth() === 11) {
        newEnd = new Date(currentEnd.getFullYear() + 1, 0, 1);
      } else {
        newEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + 1, 1);
      }
      
      // Move to the last day of that month
      newEnd.setMonth(newEnd.getMonth() + 1);
      newEnd.setDate(0);
      
      if (newEnd.getTime() > allowedMaxFR.getTime()) {
        // Reached max boundary in positive expand
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        if (dateRangeSlider.value?.noUiSlider) {
          dateRangeSlider.value.noUiSlider.set(store.totalMonths);
        }
        hasReachedLimit.value = true;
        pausePlayback();
        return;
      }
      
      // CRITICAL: ALWAYS keep first date locked for positive initial
      lockedPositivePlayback.value = true;
      isFullRangeExpandingPlayback.value = true;
      store.updateDateRange({
        startDate: new Date(effMin), // ALWAYS locked to beginning
        endDate: newEnd,
        selectedRangeMonths: monthDiff(effMin, newEnd) + 1
      });
      
    } else if (step < 0) {
      // Positive initial + negative step: contract end date but keep overlay
      const currentEnd = new Date(store.dateRange.endDate);
      let newEnd;
      
      // Go to the last day of the previous month
      newEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 0);
      
      if (newEnd.getTime() <= effMin.getTime()) {
        // Reached min boundary in positive contract
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        if (dateRangeSlider.value?.noUiSlider) {
          dateRangeSlider.value.noUiSlider.set(store.totalMonths);
        }
        hasReachedLimit.value = true;
        pausePlayback();
        return;
      }
      
      // CRITICAL: Keep overlay ON and start date LOCKED for positive initial
      lockedPositivePlayback.value = true;
      store.updateDateRange({
        startDate: new Date(effMin), // ALWAYS locked to beginning
        endDate: newEnd,
        selectedRangeMonths: monthDiff(effMin, newEnd) + 1
      });
    }
    
  } else if (initialPlaybackDirection.value < 0) {
    // For negative initial: NEVER show overlay
    if (step < 0) {
      // Negative initial + negative step: contract
      const currentEnd = new Date(store.dateRange.endDate);
      let newEnd;
      
      // Go to the last day of the previous month
      newEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth(), 0);
      
      if (newEnd.getTime() <= effMin.getTime()) {
        // Reached min boundary
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        if (dateRangeSlider.value?.noUiSlider) {
          dateRangeSlider.value.noUiSlider.set(store.totalMonths);
        }
        hasReachedLimit.value = true;
        pausePlayback();
        return;
      }
      
      // CRITICAL: ALWAYS keep overlay OFF for negative initial
      lockedPositivePlayback.value = false;
      store.updateDateRange({
        startDate: new Date(effMin), // Keep start date at beginning
        endDate: newEnd,
        selectedRangeMonths: monthDiff(effMin, newEnd) + 1
      });
      
    } else if (step > 0) {
      // Negative initial + positive step: expand but no overlay
      const currentEnd = new Date(store.dateRange.endDate);
      let newEnd;
      
      // Create a new date at the first of the next month
      if (currentEnd.getMonth() === 11) {
        newEnd = new Date(currentEnd.getFullYear() + 1, 0, 1);
      } else {
        newEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + 1, 1);
      }
      
      // Move to the last day of that month
      newEnd.setMonth(newEnd.getMonth() + 1);
      newEnd.setDate(0);
      
      if (newEnd.getTime() > allowedMaxFR.getTime()) {
        // Reached max boundary
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        if (dateRangeSlider.value?.noUiSlider) {
          dateRangeSlider.value.noUiSlider.set(store.totalMonths);
        }
        hasReachedLimit.value = true;
        pausePlayback();
        return;
      }
      
      // CRITICAL: ALWAYS keep overlay OFF for negative initial
      lockedPositivePlayback.value = false;
      store.updateDateRange({
        startDate: new Date(effMin), // Keep start date at beginning
        endDate: newEnd,
        selectedRangeMonths: monthDiff(effMin, newEnd) + 1
      });
    }
  }
}
    
    // Master moveRange: choose based on whether full‑range was selected.
    function moveRange(step) {
      if (startedWithFullRange.value) {
        moveFullRange(step);
      } else {
        moveNonFullRange(step);
      }
    }
    
    /* ====================================================
       6. Range Calculation Helper
    ====================================================== */
    function calculateRangeForMonths(months) {
      const effMin = new Date(store.effectiveFullRangeStart);
      const now = new Date();
      const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const allowedMaxNonFull = currentMonthLastDay < store.effectiveFullRangeEnd ? currentMonthLastDay : store.effectiveFullRangeEnd;
      
      if (months === store.totalMonths) {
        return {
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd)
        };
      }
      
      if (months === 1) {
        let base = store.dateRange.endDate ? new Date(store.dateRange.endDate) : new Date(allowedMaxNonFull);
        const newStart = new Date(base.getFullYear(), base.getMonth(), 1, 0, 0, 0, 0);
        const newEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
        return { startDate: newStart, endDate: newEnd };
      }
      
      if (store.dateRange.startDate && store.dateRange.endDate) {
        const currentEndOrig = new Date(store.dateRange.endDate);
        const currentEnd = new Date(currentEndOrig.getFullYear(), currentEndOrig.getMonth() + 1, 0);
        let newStart = new Date(currentEnd.getFullYear(), currentEnd.getMonth() - (months - 1), 1);
        if (newStart < effMin) {
          newStart = new Date(effMin);
          let newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + months, 0);
          if (newEnd > allowedMaxNonFull) newEnd = new Date(allowedMaxNonFull);
          return { startDate: newStart, endDate: newEnd };
        }
        return { startDate: newStart, endDate: currentEnd };
      }
      
      const newEnd = new Date(allowedMaxNonFull.getFullYear(), allowedMaxNonFull.getMonth() + 1, 0);
      let newStart = new Date(newEnd.getFullYear(), newEnd.getMonth() - (months - 1), 1);
      if (newStart < effMin) {
        newStart = new Date(effMin);
        let adjustedEnd = new Date(newStart.getFullYear(), newStart.getMonth() + months, 0);
        if (adjustedEnd > allowedMaxNonFull) adjustedEnd = new Date(allowedMaxNonFull);
        return { startDate: newStart, endDate: adjustedEnd };
      }
      return { startDate: newStart, endDate: newEnd };
    }
    
    /* ====================================================
       7. Range & Bar Click Handling
    ====================================================== */
    function handleBarClick(month, forceOneMonth = false) {
      isFullRangeExpandingPlayback.value = false;
      const [year, mStr] = month.date.split('-');
      const mIdx = parseInt(mStr) - 1;
      let newStart, newEnd;
      const effMin = new Date(store.fullRangeStart);
      const now = new Date();
      const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const allowedMaxNonFull = currentMonthLastDay < store.effectiveFullRangeEnd ? currentMonthLastDay : store.effectiveFullRangeEnd;
      
      if (forceOneMonth || store.dateRange.selectedRangeMonths === 1) {
        newStart = new Date(parseInt(year), mIdx, 1, 0, 0, 0, 0);
        newEnd = new Date(parseInt(year), mIdx + 1, 0, 23, 59, 59, 999);
        if (newStart < effMin) {
          newStart = new Date(effMin);
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
        }
        if (newEnd > allowedMaxNonFull) {
          newEnd = allowedMaxNonFull;
          newStart = new Date(newEnd.getFullYear(), newEnd.getMonth(), 1);
        }
        if (isAllRangeSelected() && dateRangeSlider.value?.noUiSlider) {
          dateRangeSlider.value.noUiSlider.set(1);
        }
        store.updateDateRange({ 
          startDate: newStart, 
          endDate: newEnd,
          selectedRangeMonths: 1
        });
      } else {
        const monthsToInclude = store.dateRange.selectedRangeMonths;
        const halfMonths = Math.floor((monthsToInclude - 1) / 2);
        let startMonth = mIdx - halfMonths;
        let endMonth = startMonth + monthsToInclude - 1;
        newStart = new Date(parseInt(year), startMonth, 1);
        newEnd = new Date(parseInt(year), endMonth + 1, 0);
        if (newStart < effMin) {
          newStart = new Date(effMin);
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + monthsToInclude, 0);
        }
        if (newEnd > allowedMaxNonFull) {
          newEnd = allowedMaxNonFull;
          newStart = new Date(newEnd.getFullYear(), newEnd.getMonth() - (monthsToInclude - 1), 1);
        }
        store.updateDateRange({ 
          startDate: newStart, 
          endDate: newEnd,
          selectedRangeMonths: monthsToInclude
        });
      }
      nextTick(() => {
        store.updateDisplayCount();
        store.updateMonthlyData();
        emitDateRangeChanged();
      });
    }
    
    function directBarClick(month) {
      if (!store.dateRange.isGraphMode) return;
      if (!isMonthActive(month)) return;
      pausePlayback(true); // Hard reset on direct click
      handleBarClick(month, isAllRangeSelected());
    }
    
    function handleYearClick(year) {
      if (!store.dateRange.isGraphMode) return;
      pausePlayback(true); // Hard reset on direct click
      isFullRangeExpandingPlayback.value = false;
      const now = new Date();
      const isCurrentYear = year === now.getFullYear();
      if (year === store.effectiveFullRangeEnd.getFullYear() || isCurrentYear) {
        const monthsWithData = store.monthlyData.filter(m => m.year === year);
        if (monthsWithData.length > 0) {
          const first = monthsWithData[0].month;
          const last = monthsWithData[monthsWithData.length - 1].month;
          const range = last - first + 1;
          const newStart = new Date(year, first, 1);
          const newEnd = new Date(year, last + 1, 0);
          store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: range });
          if (dateRangeSlider.value?.noUiSlider)
            dateRangeSlider.value.noUiSlider.set(range);
        }
      } else {
        const newStart = new Date(year, 0, 1);
        const newEnd = new Date(year, 11, 31);
        store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: 12 });
        if (dateRangeSlider.value?.noUiSlider)
          dateRangeSlider.value.noUiSlider.set(12);
      }
      nextTick(() => {
        store.updateDisplayCount();
        store.updateMonthlyData();
      });
      scrollToCurrentRange();
      emitDateRangeChanged();
    }
    
    /* ====================================================
       8. Tooltip Handling
    ====================================================== */
    function showMonthTooltip(e, month) {
      const r = e.target.getBoundingClientRect();
      tooltipStyle.value = { left: (r.left + r.width / 2) + 'px', top: r.top + 'px' };
      const lbl = month.label.replace(' г.', '');
      tooltipData.value = { ...month, label: lbl };
    }
    
    function showYearTooltip(e, yLabel) {
      const r = e.target.getBoundingClientRect();
      const cnt = store.monthlyData.filter(m => m.year === yLabel.year).reduce((s, m) => s + m.count, 0);
      tooltipStyle.value = { left: (r.left + r.width / 2) + 'px', top: r.top + 'px' };
      tooltipData.value = { label: yLabel.year, count: cnt };
    }
    
    function hideTooltip() {
      tooltipData.value = null;
    }
    
    /* ====================================================
       9. Scroll & Drag Handling
    ====================================================== */
    function scrollToCurrentRange() {
      nextTick(() => {
        if (!histogramWrapper.value) return;
        const wrapper = histogramWrapper.value;
        const eDate = store.dateRange.endDate;
        const key = eDate.getFullYear() + '-' + String(eDate.getMonth() + 1).padStart(2, '0');
        const idx = store.monthlyData.findIndex(m => m.date === key);
        if (idx === -1) return;
        const target = idx * BAR_TOTAL_WIDTH - wrapper.offsetWidth / 3;
        wrapper.scrollLeft = Math.max(0, target);
        scrollPosition.value = wrapper.scrollLeft;
      });
    }
    
    function scrollHistogramToEnd() {
      nextTick(() => {
        if (histogramWrapper.value) {
          const wrapper = histogramWrapper.value;
          wrapper.scrollLeft = wrapper.scrollWidth - wrapper.clientWidth;
          scrollPosition.value = wrapper.scrollLeft;
        }
      });
    }
    
    function scrollHistogramToBeginning() {
      nextTick(() => {
        if (histogramWrapper.value) {
          const wrapper = histogramWrapper.value;
          wrapper.scrollLeft = 0;
          scrollPosition.value = wrapper.scrollLeft;
        }
      });
    }
    
    function handleScroll() {
      if (histogramWrapper.value && !isScrollbarDragging.value)
        scrollPosition.value = histogramWrapper.value.scrollLeft;
    }
    
    function handleScrollbarClick(e) {
      if (!histogramWrapper.value || isScrollbarDragging.value) return;
      if (store.playback.isPlaying) pausePlayback();
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const container = histogramWrapper.value;
      const maxScroll = container.scrollWidth - container.clientWidth;
      container.scrollLeft = maxScroll * (clickX / container.clientWidth);
      scrollPosition.value = container.scrollLeft;
    }
    
    function startScrollbarDrag(e) {
      if (!store.dateRange.isGraphMode) return;
      isScrollbarDragging.value = true;
      dragStartX.value = e.clientX;
      if (store.playback.isPlaying) pausePlayback();
      document.addEventListener('mousemove', handleScrollbarDrag);
      document.addEventListener('mouseup', stopScrollbarDrag);
    }
    
    function handleScrollbarDrag(e) {
      if (!isScrollbarDragging.value || !histogramWrapper.value) return;
      const dx = e.clientX - dragStartX.value;
      dragStartX.value = e.clientX;
      const wrapper = histogramWrapper.value;
      const scrollAmt = dx * (wrapper.scrollWidth / wrapper.clientWidth);
      wrapper.scrollLeft += scrollAmt;
      scrollPosition.value = wrapper.scrollLeft;
    }
    
    function stopScrollbarDrag() {
      isScrollbarDragging.value = false;
      document.removeEventListener('mousemove', handleScrollbarDrag);
      document.removeEventListener('mouseup', stopScrollbarDrag);
    }
    
    function startRangeDrag(e) {
      if (!store.dateRange.isGraphMode || isAllRangeSelected() || isFullRangeExpandingPlayback.value) return;
      isDragging.value = true;
      dragStartX.value = e.clientX;
      document.addEventListener('mousemove', handleRangeDrag);
      document.addEventListener('mouseup', stopRangeDrag);
    }
    
    function handleRangeDrag(e) {
      if (!isDragging.value || !store.dateRange.isGraphMode || isAllRangeSelected())
        return;
      const dx = e.clientX - dragStartX.value;
      const delta = Math.round(dx / BAR_TOTAL_WIDTH);
      if (delta !== 0) {
        let newStart = new Date(store.dateRange.startDate.getFullYear(), store.dateRange.startDate.getMonth() + delta, 1);
        let newEnd;
        if (store.dateRange.selectedRangeMonths === 1)
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
        else
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + store.dateRange.selectedRangeMonths, 0);
        const minD = new Date(store.fullRangeStart);
        const maxD = new Date(store.fullRangeEnd);
        if (newEnd <= maxD && newStart >= minD) {
          store.updateDateRange({ startDate: newStart, endDate: newEnd });
          dragStartX.value = e.clientX;
          emitDateRangeChanged();
        }
      }
    }
    
    function stopRangeDrag() {
      isDragging.value = false;
      document.removeEventListener('mousemove', handleRangeDrag);
      document.removeEventListener('mouseup', stopRangeDrag);
      scrollToCurrentRange();
    }
    
    /* ====================================================
       10. Keyboard Handling
    ====================================================== */
    function handleKeyDown(e) {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePauseWithMemory();
      }
    }
    
    function togglePauseWithMemory() {
      if (!store.dateRange.isGraphMode || !playbackSlider.value?.noUiSlider) return;
      const curIdx = parseInt(playbackSlider.value.noUiSlider.get());
      if (curIdx !== allowedValues.indexOf(0))
        store.updatePlaybackState({ lastNonZeroIndex: curIdx });
      if (!store.playback.isPaused) {
        store.updatePlaybackState({ isPlaying: false, isPaused: true });
        destroyPlaybackInterval();
        playbackSlider.value.noUiSlider.set(allowedValues.indexOf(0));
      } else {
        const resumeIdx = store.playback.lastNonZeroIndex !== undefined ? store.playback.lastNonZeroIndex : allowedValues.indexOf(1);
        playbackSlider.value.noUiSlider.set(resumeIdx);
      }
    }
    
    /* ====================================================
       11. Emit Date Range Change Event
    ====================================================== */
    function emitDateRangeChanged() {
      emit('dateRangeChanged', {
        startDate: store.dateRange.startDate,
        endDate: store.dateRange.endDate,
        selectedRangeMonths: store.dateRange.selectedRangeMonths
      });
    }
    
    /* ====================================================
       12. Lifecycle Hooks & Watchers
    ====================================================== */
    watch(() => store.monthlyData, () => {
      nextTick(() => {
        if (store.dateRange.isGraphMode && histogramWrapper.value)
          scrollPosition.value = histogramWrapper.value.scrollLeft;
      });
    });
    
    onMounted(() => {
      hasReachedLimit.value = false;
      isFullRangeExpandingPlayback.value = false;
      initialPlaybackDirection.value = 0;
      lockedPositivePlayback.value = false;
      startedWithFullRange.value = false;
      transitionedFromFullRange.value = false;
      wasPausedInFullRange.value = false;
      pausedFullRangeDirection.value = 0;
      
      if (store.playback.isPlaying) {
        store.updatePlaybackState({
          isPlaying: false,
          isPaused: true,
          speed: 1
        });
      }
      
      if (store.dateRange.isGraphMode) {
        nextTick(() => {
          initializeDateRangeSlider();
          initializePlaybackSlider();
          if (dateRangeSlider.value?.noUiSlider) {
            dateRangeSlider.value.noUiSlider.set(store.dateRange.selectedRangeMonths || store.totalMonths);
          }
          if (playbackSlider.value?.noUiSlider) {
            playbackSlider.value.noUiSlider.set(allowedValues.indexOf(0));
          }
          store.updateDisplayCount();
          store.updateMonthlyData();
          if (isAllRangeSelected()) {
            scrollHistogramToEnd();
          } else {
            scrollToCurrentRange();
          }
        });
      }
      
      document.addEventListener('keydown', handleKeyDown);
    });
    
    onBeforeUnmount(() => {
      pausePlayback(true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleRangeDrag);
      document.removeEventListener('mouseup', stopRangeDrag);
      document.removeEventListener('mousemove', handleScrollbarDrag);
      document.removeEventListener('mouseup', stopScrollbarDrag);
      destroySliders();
    });
    
    function stopAllPlayback() {
      if (playbackSlider.value?.noUiSlider)
        playbackSlider.value.noUiSlider.set(allowedValues.indexOf(0));
      store.updatePlaybackState({
        isPlaying: false,
        isPlayingBackwards: store.playback.isPlayingBackwards,
        isPaused: true
      });
      destroyPlaybackInterval();
    }
    
    /* ====================================================
       13. Return to Template
    ====================================================== */
    return {
      store,
      dateRangeSlider,
      playbackSlider,
      histogramWrapper,
      histogramContainer,
      tooltipData,
      tooltipStyle,
      formattedStartDate,
      formattedEndDate,
      showRangeOverlay,
      rangeOverlayStyle,
      customScrollbarStyle,
      toggleGraphMode: function toggleGraphMode() {
          pausePlayback(true); // Hard reset when toggling graph mode
          const wasGraph = store.dateRange.isGraphMode;
          if (wasGraph) {
            lockedPositivePlayback.value = false;
            initialPlaybackDirection.value = 0;
            wasPausedInFullRange.value = false;
          }
          store.updateDateRange({ isGraphMode: !wasGraph });
          if (!store.dateRange.isGraphMode) {
            store.updateDateRange({
              startDate: new Date(store.fullRangeStart),
              endDate: new Date(store.fullRangeEnd),
              selectedRangeMonths: store.totalMonths
            });
            destroySliders();
            emitDateRangeChanged();
            store.updateDisplayCount();
            store.updateMonthlyData();
          } else {
            nextTick(() => {
              initializeDateRangeSlider();
              initializePlaybackSlider();
              scrollHistogramToEnd();
            });
          }
      },
      containerClick(e) {
        if (!store.dateRange.isGraphMode) return;
        pausePlayback(true); // Hard reset on direct click
        const rect = histogramContainer.value.getBoundingClientRect();
        const idx = Math.floor((e.clientX - rect.left) / BAR_TOTAL_WIDTH);
        if (idx >= 0 && idx < store.monthlyData.length) {
          const m = store.monthlyData[idx];
          if (!isMonthActive(m)) return;
          const forceOne = isAllRangeSelected();
          handleBarClick(m, forceOne);
        }
      },
      directBarClick,
      handleYearClick,
      showMonthTooltip,
      showYearTooltip,
      hideTooltip,
      getBarHeight,
      getBarOpacity,
      isMonthActive,
      isInCurrentRange,
      isYearInRange,
      startRangeDrag,
      startScrollbarDrag,
      handleScroll,
      handleScrollbarClick,
      computedYearLabels,
      isFutureMonth
    };
  }
};
</script>
<style scoped>
.date-controls-container {
  position: absolute;
  bottom: 10px;
  left: 10px;
  right: 10px;
  z-index: 15;
}
.date-slider-container {
  background-color: rgba(0, 0, 0, 0.6); 
  border-radius: 4px;
  width: calc(100vw - 25px);
  position: relative;
  padding: 0;
  height: 100%;
  display: inline-block; 
}
.control-buttons-row {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 25px;
  width: calc(100vw - 40px);
  max-width: 100%;
  position: fixed;
  bottom: 10px;
  left: 10px;
  padding: 10px;
}
.button-time {
  padding: 8px 12px; 
  background-color: rgba(0,0,0,.6); 
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  margin: 0 4px;
  position: relative;
  bottom: -15px;
}
#app .button-time:hover { 
  color: black !important;
  background-color: white;
}
.controls-group {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: nowrap;
  width: 90%;
  justify-content: space-between;
}
.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 5px;
  color: white;
  opacity: 0.5;
  pointer-events: none;
  position: relative;
  bottom: -15px;
}
.date-range-slider-container {
  width: 200px;
  margin: 0 10px;
}
.playback-slider-container {
  min-width: 250px;
}
.stats-group {
  margin-left: auto;
  margin-top: 10px;
}
.date-stats {
  color: white;
  font-size: 14px;
  text-align: center;
}

/* Histogram and slider styles */
.histogram-wrapper {
  overflow-x: auto;
  white-space: nowrap;
  position: relative;
  margin-top: 20px;
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
  margin-bottom: 100px;
}
.histogram-wrapper::-webkit-scrollbar {
  display: none;  /* Chrome, Safari and Opera */
}
.histogram-scroll-container {
  display: inline-block;
  position: relative;
  padding-bottom: 25px; /* Space for scrollbar */
}
.histogram-container {
  position: relative;
  height: 150px;
  display: flex;
  align-items: flex-end;
  border-bottom: 1px solid #fff;
  cursor: pointer;
}
.histogram-bar {
  background-color: white;
  width: 3px;
  max-width: 3px;
  flex: 1 0 auto;
  margin: 0 2px;
  transition: all 0.3s ease;
  position: relative;
  z-index: 2;
}
.histogram-bar.inactive {
  background-color: rgba(255, 255, 255, 0.3);
}
.histogram-bar.active:not(.in-range) {
  opacity: 0.5;
} 
.year-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px; 
  position: relative; 
  height: 1.2rem;
} 
.year-label {
  flex: 1 0 auto;
  min-width: 84px;
  text-align: center;
  cursor: pointer;
  user-select: none;
  position: absolute;
  font-size: 0.8rem;
  padding-top: 5px;
  padding-bottom: 5px;
}
#app .year-label.highlighted {
	background-color: white;
	color: black !important;
}
.year-label:hover,
.year-label.active {
  opacity: 1;
}
.histogram-tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 20;
  transform: translate(-50%, -100%);
  font-size: 12px;
}
.range-selection-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.2);
  pointer-events: none;
  z-index: 1;
}

/* Custom scrollbar styles */
.custom-scrollbar-container {
  position: absolute;
  height: 10px;
  bottom: 100px;
  left: 0;
  right: 0; 
  border-radius: 5px;
  cursor: pointer;
}
.custom-scrollbar {
  position: absolute;
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 5px;
  top: 0;
  cursor: grab;
}
.custom-scrollbar:active {
  cursor: grabbing;
}

/* Additional selectors */
#app .date-slider-container * {
  color: white !important;
}

.control-button.active {
  background-color: rgba(255, 255, 255, 0.9) !important;
  color: black !important;
}
#app .control-buttons-row .control-button.active {
  color: black !important;
} 

/* noUiSlider rules for date slider */ 
.date-slider-container :deep(.noUi-target) {
  background-color: transparent;
}
.date-slider-container :deep(.noUi-horizontal) .noUi-handle {
  cursor: pointer;
  width: 15px;
  right: -8px;
}
.date-slider-container :deep(.noUi-horizontal) .noUi-handle::after,
.date-slider-container :deep(.noUi-horizontal) .noUi-handle::before {
  display: none;
}

.date-slider-container.disabled {
  opacity: 0.5;
}
.playback-slider-container :deep(.noUi-value[data-value="0"]::before){ 
  content: '◄◄◄';
  font-size: 12px !important;
  line-height: 12px;
}
.playback-slider-container :deep(.noUi-value[data-value="1"]::before){ 
  content: '◄◄';
  font-size: 12px !important;
  line-height: 12px;
}
:deep(.noUi-value[data-value="2"]::before){ 
  content: '◄';
  font-size: 12px !important;
  line-height: 12px;
}
.playback-slider-container  :deep(.noUi-value){
  font-size: 0 !important;
}
.playback-slider-container :deep(.noUi-value[data-value="3"]){  
  font-size: 12px !important;
  line-height: 12px;
}
.playback-slider-container :deep(.noUi-value[data-value="4"]::before){ 
  content: '►';
  font-size: 12px !important;
  line-height: 12px;
}
.playback-slider-container :deep(.noUi-value[data-value="5"]::before){ 
  content: '►►';
  font-size: 12px !important;
  line-height: 12px;
}
.playback-slider-container :deep(.noUi-value[data-value="6"]::before){ 
  content: '►►►';
  font-size: 12px !important;
  line-height: 12px;
}
 
:deep(.noUi-value-horizontal:last-child){
  font-weight: bold;
}


@media (max-width: 1150px) {
  .date-controls-container{ 
    bottom: 0;
    left: 0;
    right: 0; 
    position: fixed;
  }
  .date-slider-container{
    width: 100vw;
    line-height: 0;
    vertical-align: top;
  }
  .playback-slider-container { 
    display: block;
    width: 80%; 
    margin-left: auto;
    margin-right: auto;
  }
  .histogram-wrapper {
    display: block;
    width: 80%; 
    margin-left: auto;
    margin-right: auto;
  }
  .date-slider-container > .histogram-wrapper {
    margin-bottom: 185px;
    padding-top: 20px;
  }
  .year-label { 
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .custom-scrollbar-container{
    width: 80%;
    margin: 0 auto;
    position: relative;
    display: block;
    bottom: 200px;
  }
  .date-range-slider-container {
    display: block;
    width: 80%;
    margin-bottom: 60px;
    margin-left: auto;
    margin-right: auto;
  }
  .controls-group {
    display: block;
    width: 100%;
    margin-bottom: 50px;
  }
  .button-time {
    position: fixed;
    left: 10px;
    bottom: 10px;
    z-index: 999;
    padding: 8px 12px;
    background-color: black;
    border: 1px solid white;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    margin: 0;
  }
  .filter-checkbox {
    position: fixed;
    bottom: 20px;
    left: 100px;
  }
  .date-slider-container :deep(.noUi-pips-horizontal){
    padding: 20px 0;   
  }
  .stats-group {
    padding-top: 10px;
  }
  .histogram-tooltip{
    display: none;
  }
}
</style>