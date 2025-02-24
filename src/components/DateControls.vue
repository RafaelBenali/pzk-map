<template>
  <div class="date-controls-container">
    <div class="date-slider-container">
      <div class="control-buttons-row">
        <!-- "Время" button -->
        <button
          class="control-button button-time"
          :class="{ active: store.dateRange.isGraphMode }"
          @click="toggleGraphMode"
        >
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
      <div v-if="store.dateRange.isGraphMode" class="histogram-wrapper" ref="histogramWrapper">
        <div class="histogram-scroll-container">
          <!-- Histogram container: clicking here uses fixed bar width -->
          <div
            class="histogram-container"
            ref="histogramContainer"
            @click="containerClick"
          >
            <!-- Range Selection Overlay -->
            <div
              v-if="showRangeOverlay"
              class="range-selection-overlay"
              :style="rangeOverlayStyle"
              @mousedown.prevent="startRangeDrag"
            ></div>
            <!-- Render each bar -->
            <div
              v-for="(month, index) in store.monthlyData"
              :key="month.date"
              class="histogram-bar"
              :class="{ active: isMonthActive(month), 'in-range': isInCurrentRange(month) }"
              :style="{ height: getBarHeight(month), opacity: getBarOpacity(month) }"
              @click.stop="directBarClick(month)"
              @mouseenter="showMonthTooltip($event, month)"
              @mouseleave="hideTooltip"
            ></div>
          </div>
          <div class="year-labels">
            <div
              v-for="yearLabel in computedYearLabels"
              :key="yearLabel.year"
              class="year-label"
              :style="{ left: yearLabel.left }"
              :class="{ highlighted: isYearInRange(yearLabel.year) }"
              @click.stop="handleYearClick(yearLabel.year)"
            >
              {{ yearLabel.year }}
            </div>
          </div>
        </div>
        <!-- Tooltip element -->
        <div
          v-if="tooltipData"
          class="histogram-tooltip"
          :style="tooltipStyle"
        >
          <div>{{ tooltipData.label }}</div>
          <div>Количество: {{ tooltipData.count }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useMapStore } from '../stores/mapStore';
import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';

export default {
  name: 'DateControls',
  emits: ['dateRangeChanged'],
  setup(props, { emit }) {
    const store = useMapStore();
    const dateRangeSlider = ref(null);
    const playbackSlider = ref(null);
    const histogramWrapper = ref(null);
    const histogramContainer = ref(null);
    const tooltipData = ref(null);
    const tooltipStyle = ref(null);
    const isDragging = ref(false);
    const dragStartX = ref(null);
    const lastSliderValue = ref(null);
    // Our design: each bar has width 3px + margin-right 4px = 7px total.
    const BAR_TOTAL_WIDTH = 7;

    const formattedStartDate = computed(() =>
      store.dateRange.startDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
    );
    const formattedEndDate = computed(() =>
      store.dateRange.endDate.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
    );
    const showRangeOverlay = computed(() =>
      store.dateRange.isGraphMode && !isAllRangeSelected()
    );
    // Overlay computed relative to effectiveFullRangeStart.
    const rangeOverlayStyle = computed(() => {
      if (!store.dateRange.startDate || !store.dateRange.endDate) return { display: 'none' };
      const offset =
        (store.dateRange.startDate.getFullYear() - store.effectiveFullRangeStart.getFullYear()) * 12 +
        (store.dateRange.startDate.getMonth() - store.effectiveFullRangeStart.getMonth());
      const monthsDiff =
        (store.dateRange.endDate.getFullYear() - store.dateRange.startDate.getFullYear()) * 12 +
        (store.dateRange.endDate.getMonth() - store.dateRange.startDate.getMonth()) + 1;
      return { left: offset * BAR_TOTAL_WIDTH + 'px', width: monthsDiff * BAR_TOTAL_WIDTH + 'px' };
    });
    // Compute year labels: each time the year changes in monthlyData, record the index.
    const computedYearLabels = computed(() => {
      const labels = [];
      const mData = store.monthlyData;
      mData.forEach((month, index) => {
        if (index === 0 || month.year !== mData[index - 1].year) {
          labels.push({ year: month.year, left: (index * BAR_TOTAL_WIDTH) + 'px' });
        }
      });
      return labels;
    });

    function isAllRangeSelected() {
      return store.dateRange.selectedRangeMonths === store.effectiveTotalMonths;
    }
    // When clicking on the container (empty space), use fixed BAR_TOTAL_WIDTH.
    function containerClick(e) {
      if (!store.dateRange.isGraphMode) return;
      stopAllPlayback();
      const container = histogramContainer.value;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const idx = Math.floor(clickX / BAR_TOTAL_WIDTH);
      if (idx >= 0 && idx < store.monthlyData.length) {
        const force = (store.dateRange.selectedRangeMonths === store.effectiveTotalMonths);
        handleBarClick(store.monthlyData[idx], force);
      }
    }
    function toggleGraphMode() {
      stopAllPlayback();
      store.updateDateRange({ isGraphMode: !store.dateRange.isGraphMode });
      if (!store.dateRange.isGraphMode) {
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        destroySliders();
        emit('dateRangeChanged', {
          startDate: store.dateRange.startDate,
          endDate: store.dateRange.endDate,
          selectedRangeMonths: store.dateRange.selectedRangeMonths
        });
      } else {
        nextTick(() => {
          initializeDateRangeSlider();
          initializePlaybackSlider();
          scrollHistogramToEnd();
        });
      }
    }
    // Fix: for multi-month selection, compute the starting month as first day.
    function handleBarClick(month, forceOneMonth = false) {
      if (store.dateRange.selectedRangeMonths === store.totalMonths) {
        forceOneMonth = true;
      }
      const [year, monthStr] = month.date.split('-');
      const mIdx = parseInt(monthStr) - 1;
      const newEndDate = new Date(parseInt(year), mIdx + 1, 0);
      let newStartDate;
      if (forceOneMonth || store.dateRange.selectedRangeMonths === 1) {
        newStartDate = new Date(parseInt(year), mIdx, 1);
      } else {
        // Instead of copying newEndDate, compute using the clicked month index.
        newStartDate = new Date(parseInt(year), mIdx - (store.dateRange.selectedRangeMonths - 1), 1);
      }
      store.updateDateRange({ startDate: newStartDate, endDate: newEndDate });
      if ((forceOneMonth || store.dateRange.selectedRangeMonths === 1) && dateRangeSlider.value?.noUiSlider) {
        nextTick(() => {
          dateRangeSlider.value.noUiSlider.set(1);
        });
      }
      emit('dateRangeChanged', {
        startDate: store.dateRange.startDate,
        endDate: store.dateRange.endDate,
        selectedRangeMonths: store.dateRange.selectedRangeMonths
      });
    }
    function directBarClick(month) {
      if (!store.dateRange.isGraphMode) return;
      stopAllPlayback();
      handleBarClick(month, false);
    }
    // When clicking a year, if it is the last available year, select only the available months;
    // otherwise select 12 months.
    function handleYearClick(year) {
      if (!store.dateRange.isGraphMode) return;
      stopAllPlayback();
      if (year === store.effectiveFullRangeEnd.getFullYear()) {
        const monthsThisYear = store.monthlyData.filter(m => m.year === year);
        if (monthsThisYear.length > 0) {
          const firstAvail = monthsThisYear[0].month;
          const lastAvail = monthsThisYear[monthsThisYear.length - 1].month;
          const rangeMonths = lastAvail - firstAvail + 1;
          const newStart = new Date(year, firstAvail, 1);
          const newEnd = new Date(year, lastAvail + 1, 0);
          store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: rangeMonths });
          if (dateRangeSlider.value?.noUiSlider) {
            dateRangeSlider.value.noUiSlider.set(rangeMonths);
          }
        }
      } else {
        const newStart = new Date(year, 0, 1);
        const newEnd = new Date(year, 11, 31);
        store.updateDateRange({ startDate: newStart, endDate: newEnd, selectedRangeMonths: 12 });
        if (dateRangeSlider.value?.noUiSlider) {
          dateRangeSlider.value.noUiSlider.set(12);
        }
        updateDateRangeFromMonths();
      }
      emit('dateRangeChanged', {
        startDate: store.dateRange.startDate,
        endDate: store.dateRange.endDate,
        selectedRangeMonths: store.dateRange.selectedRangeMonths
      });
    }
    function getBarHeight(month) {
      return store.maxCount > 0 ? `${(month.count / store.maxCount) * 100}%` : '0%';
    }
    function getBarOpacity(month) {
      if (!store.dateRange.isGraphMode) return 1;
      return isInCurrentRange(month) ? 1 : 0.3;
    }
    function isMonthActive(month) {
      return isInCurrentRange(month);
    }
    // This function compares the bar’s month (first day) with the selected range.
    function isInCurrentRange(month) {
      if (!store.dateRange.isGraphMode) return true;
      if (!store.dateRange.startDate || !store.dateRange.endDate) return true;
      const monthDate = new Date(month.year, month.month);
      return monthDate >= store.dateRange.startDate && monthDate <= store.dateRange.endDate;
    }
    function isYearInRange(year) {
      if (!store.dateRange.isGraphMode) return false;
      if (!store.dateRange.startDate || !store.dateRange.endDate) return false;
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      return (
        (store.dateRange.startDate >= yearStart && store.dateRange.startDate <= yearEnd) ||
        (store.dateRange.endDate >= yearStart && store.dateRange.endDate <= yearEnd) ||
        (store.dateRange.startDate <= yearStart && store.dateRange.endDate >= yearEnd)
      );
    }
    function showMonthTooltip(event, month) {
      const rect = event.target.getBoundingClientRect();
      tooltipStyle.value = { left: rect.left + rect.width / 2 + 'px', top: rect.top + 'px' };
      tooltipData.value = month;
    }
    function showYearTooltip(event, yearLabel) {
      const rect = event.target.getBoundingClientRect();
      const count = store.monthlyData.filter(m => m.year === yearLabel.year)
                                      .reduce((sum, m) => sum + m.count, 0);
      if (count > 0) {
        tooltipStyle.value = { left: rect.left + rect.width / 2 + 'px', top: rect.top + 'px' };
        tooltipData.value = { label: `${yearLabel.year} год`, count };
      }
    }
    function hideTooltip() {
      tooltipData.value = null;
    }
    function startRangeDrag(event) {
      if (!store.dateRange.isGraphMode || isAllRangeSelected()) return;
      isDragging.value = true;
      dragStartX.value = event.clientX;
      document.addEventListener('mousemove', handleRangeDrag);
      document.addEventListener('mouseup', stopRangeDrag);
    }
    function handleRangeDrag(event) {
      if (!isDragging.value || !store.dateRange.isGraphMode || isAllRangeSelected()) return;
      const dx = event.clientX - dragStartX.value;
      const monthsDelta = Math.round(dx / BAR_TOTAL_WIDTH);
      if (monthsDelta !== 0) {
        let newStart = new Date(store.dateRange.startDate);
        newStart.setMonth(newStart.getMonth() + monthsDelta);
        let newEnd;
        if (store.dateRange.selectedRangeMonths === 1) {
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
        } else {
          newEnd = new Date(newStart);
          newEnd.setMonth(newStart.getMonth() + (store.dateRange.selectedRangeMonths - 1));
        }
        const minDate = new Date(store.fullRangeStart);
        const maxDate = new Date(store.fullRangeEnd);
        if (newEnd <= maxDate && newStart >= minDate) {
          store.updateDateRange({ startDate: newStart, endDate: newEnd });
          dragStartX.value = event.clientX;
          emit('dateRangeChanged', {
            startDate: store.dateRange.startDate,
            endDate: store.dateRange.endDate,
            selectedRangeMonths: store.dateRange.selectedRangeMonths
          });
        }
      }
    }
    function stopRangeDrag() {
      isDragging.value = false;
      document.removeEventListener('mousemove', handleRangeDrag);
      document.removeEventListener('mouseup', stopRangeDrag);
      scrollToCurrentRange();
    }
    function initializeDateRangeSlider() {
      const element = dateRangeSlider.value;
      if (!element) return;
      if (element.noUiSlider) { element.noUiSlider.destroy(); }
      const maxMonths = store.totalMonths;
      const format = {
        to: value => {
          const months = parseInt(value);
          if (months === maxMonths) return '2000 - ' + store.fullRangeEnd.getFullYear();
          if (months === 120) return '10л';
          if (months === 60) return '5л';
          if (months === 36) return '3г';
          if (months === 24) return '2г';
          if (months === 18) return '1.5г';
          if (months === 12) return '1г';
          if (months === 6) return '6м';
          if (months === 3) return '3м';
          if (months === 1) return '1м';
          if (months > 12) {
            const years = Math.floor(months / 12);
            const remaining = months % 12;
            return remaining === 0 ? `${years}г` : `${years}г ${remaining}м`;
          }
          return `${months}м`;
        },
        from: () => {}
      };
      noUiSlider.create(element, {
        start: [store.dateRange.selectedRangeMonths || maxMonths],
        connect: [true, false],
        direction: 'rtl',
        range: {
          min: [1],
          '10%': [3],
          '20%': [6],
          '30%': [12],
          '40%': [18],
          '50%': [24],
          '60%': [36],
          '70%': [60],
          '80%': [120],
          max: [maxMonths]
        },
        step: null,
        tooltips: [format],
        pips: {
          mode: 'values',
          values: [maxMonths, 120, 60, 36, 24, 18, 12, 6, 3, 1],
          format,
          density: 4
        }
      });
      element.noUiSlider.on('update', values => {
        const months = Math.round(parseFloat(values[0]));
        if (lastSliderValue.value !== months) {
          lastSliderValue.value = months;
          stopAllPlayback();
          store.updateDateRange({ selectedRangeMonths: months });
          updateDateRangeFromMonths();
          scrollToCurrentRange();
          emit('dateRangeChanged', {
            startDate: store.dateRange.startDate,
            endDate: store.dateRange.endDate,
            selectedRangeMonths: store.dateRange.selectedRangeMonths
          });
        }
      });
      element.querySelectorAll('.noUi-value').forEach(pip => {
        pip.style.cursor = 'pointer';
        pip.addEventListener('click', event => {
          stopAllPlayback();
          const text = event.target.innerText;
          let months = maxMonths;
          if (text.includes('10л')) months = 120;
          else if (text.includes('5л')) months = 60;
          else if (text.includes('3г')) months = 36;
          else if (text.includes('2г')) months = 24;
          else if (text.includes('1.5г')) months = 18;
          else if (text.includes('1г')) months = 12;
          else if (text.includes('6м')) months = 6;
          else if (text.includes('3м')) months = 3;
          else if (text.includes('1м')) months = 1;
          element.noUiSlider.set(months);
        });
      });
    }
    function initializePlaybackSlider() {
      const element = playbackSlider.value;
      if (!element) return;
      if (element.noUiSlider) { element.noUiSlider.destroy(); }
      const allowedValues = [-8, -4, -2, -1, 0, 1, 2, 4, 8];
      const startIndex = allowedValues.indexOf(0);
      noUiSlider.create(element, {
        start: [startIndex],
        range: { min: 0, max: 8 },
        step: 1,
        tooltips: false,
        pips: {
          mode: 'values',
          values: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          format: {
            to: value => {
              const speed = allowedValues[value];
              return speed === 0 ? 'Pause' : speed + 'x';
            }
          },
          density: 10
        }
      });
      element.noUiSlider.on('update', values => {
        const index = parseInt(values[0]);
        setPlaybackSpeedAndDirection(allowedValues[index]);
      });
      element.querySelectorAll('.noUi-value').forEach(pip => {
        pip.style.cursor = 'pointer';
        pip.addEventListener('click', event => {
          const text = event.target.innerText;
          let index = allowedValues.indexOf(0);
          if (text !== 'Pause') {
            const speed = parseInt(text.replace('x', ''));
            index = allowedValues.indexOf(speed);
          }
          element.noUiSlider.set(index);
        });
      });
    }
    let playbackInterval = null;
    function setPlaybackSpeedAndDirection(speed) {
      if (speed === 0) {
        store.updatePlaybackState({ isPlaying: false, isPlayingBackwards: false, isPaused: true, speed: 1 });
        destroyPlaybackInterval();
      } else {
        store.updatePlaybackState({
          isPaused: false,
          speed: Math.abs(speed),
          isPlaying: true,
          isPlayingBackwards: speed < 0
        });
        if (
          isAllRangeSelected() &&
          store.dateRange.startDate.getTime() === new Date(2000, 0, 1).getTime() &&
          store.dateRange.endDate.getTime() === new Date(store.fullRangeEnd).getTime() &&
          !store.playback.allRangeForwardInitialized &&
          speed > 0
        ) {
          store.updateDateRange({ endDate: new Date(store.fullRangeStart) });
          store.playback.allRangeForwardInitialized = true;
        }
        updatePlaybackInterval();
      }
    }
    function updatePlaybackInterval() {
      destroyPlaybackInterval();
      if (!store.playback.isPlaying) return;
      const intervalMs = 1000 / store.playback.speed;
      playbackInterval = setInterval(() => {
        moveRange(store.playback.isPlayingBackwards ? -1 : 1);
      }, intervalMs);
    }
    function destroyPlaybackInterval() {
      if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
      }
    }
    function stopAllPlayback() {
      store.updatePlaybackState({ isPlaying: false, isPlayingBackwards: false, isPaused: true });
      destroyPlaybackInterval();
      if (playbackSlider.value?.noUiSlider) {
        const zeroIndex = 4;
        playbackSlider.value.noUiSlider.set(zeroIndex);
      }
    }
    function moveRange(step) {
      if (!store.dateRange.isGraphMode) return;
      if (isAllRangeSelected() && store.playback.isPlaying) {
        let newEnd = new Date(store.dateRange.endDate);
        newEnd.setMonth(newEnd.getMonth() + step);
        if (store.playback.isPlayingBackwards) {
          if (newEnd < new Date(2000, 0, 1)) {
            store.updateDateRange({ endDate: new Date(2000, 0, 1) });
            stopAllPlayback();
          } else {
            store.updateDateRange({ endDate: newEnd });
          }
        } else {
          if (newEnd > new Date(store.fullRangeEnd)) {
            store.updateDateRange({ endDate: new Date(store.fullRangeEnd) });
            stopAllPlayback();
          } else {
            store.updateDateRange({ endDate: newEnd });
          }
        }
      } else {
        let newStart = new Date(store.dateRange.startDate);
        newStart.setMonth(newStart.getMonth() + step);
        let newEnd;
        if (store.dateRange.selectedRangeMonths === 1) {
          newEnd = new Date(newStart.getFullYear(), newStart.getMonth() + 1, 0);
        } else {
          newEnd = new Date(newStart);
          newEnd.setMonth(newStart.getMonth() + (store.dateRange.selectedRangeMonths - 1));
        }
        if (newEnd > new Date(store.fullRangeEnd)) {
          const start = new Date(store.fullRangeStart);
          let end = new Date(start);
          end.setMonth(start.getMonth() + (store.dateRange.selectedRangeMonths - 1));
          store.updateDateRange({ startDate: start, endDate: end });
        } else if (newStart < new Date(2000, 0, 1)) {
          let end = new Date(store.fullRangeEnd);
          let start = new Date(end);
          start.setMonth(end.getMonth() - (store.dateRange.selectedRangeMonths - 1));
          store.updateDateRange({ startDate: start, endDate: end });
        } else {
          store.updateDateRange({ startDate: newStart, endDate: newEnd });
        }
      }
      scrollToCurrentRange();
      emit('dateRangeChanged', {
        startDate: store.dateRange.startDate,
        endDate: store.dateRange.endDate,
        selectedRangeMonths: store.dateRange.selectedRangeMonths
      });
    }
    function scrollToCurrentRange() {
      nextTick(() => {
        if (!histogramWrapper.value) return;
        const wrapper = histogramWrapper.value;
        const container = wrapper.querySelector('.histogram-scroll-container');
        if (!container) return;
        const endDate = store.dateRange.endDate;
        const endKey = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
        const index = store.monthlyData.findIndex(m => m.date === endKey);
        if (index === -1) return;
        const targetPosition = index * BAR_TOTAL_WIDTH - wrapper.offsetWidth / 3;
        wrapper.scrollTo({ left: Math.max(0, targetPosition) });
      });
    }
    function scrollHistogramToEnd() {
      nextTick(() => {
        if (histogramWrapper.value) {
          histogramWrapper.value.scrollLeft = histogramWrapper.value.scrollWidth;
        }
      });
    }
    function handleKeyDown(event) {
      if (event.code === 'Space') {
        event.preventDefault();
        togglePauseWithMemory();
      }
    }
    function togglePauseWithMemory() {
      if (!store.dateRange.isGraphMode || !playbackSlider.value?.noUiSlider) return;
      const currentIndex = parseInt(playbackSlider.value.noUiSlider.get());
      const allowedValues = [-8, -4, -2, -1, 0, 1, 2, 4, 8];
      const currentValue = allowedValues[currentIndex];
      if (store.playback.isPaused) {
        if (
          isAllRangeSelected() &&
          store.dateRange.startDate.getTime() === new Date(2000, 0, 1).getTime() &&
          store.dateRange.endDate.getTime() === new Date(store.fullRangeEnd).getTime() &&
          !store.playback.isPlaying &&
          !store.playback.isPlayingBackwards
        ) {
          playbackSlider.value.noUiSlider.set(allowedValues.indexOf(-1));
        } else {
          playbackSlider.value.noUiSlider.set(store.playback.lastNonZeroIndex);
        }
      } else {
        if (currentValue !== 0) {
          store.updatePlaybackState({ lastNonZeroIndex: currentIndex });
        }
        playbackSlider.value.noUiSlider.set(allowedValues.indexOf(0));
      }
    }
    onMounted(() => {
      if (store.dateRange.isGraphMode) {
        nextTick(() => {
          initializeDateRangeSlider();
          initializePlaybackSlider();
          scrollHistogramToEnd();
        });
      }
      document.addEventListener('keydown', handleKeyDown);
    });
    onBeforeUnmount(() => {
      stopAllPlayback();
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleRangeDrag);
      document.removeEventListener('mouseup', stopRangeDrag);
      destroySliders();
    });
    function destroySliders() {
      if (dateRangeSlider.value?.noUiSlider) {
        dateRangeSlider.value.noUiSlider.destroy();
      }
      if (playbackSlider.value?.noUiSlider) {
        playbackSlider.value.noUiSlider.destroy();
      }
    }
    function updateDateRangeFromMonths() {
      if (!store.dateRange.isGraphMode) {
        store.updateDateRange({
          startDate: new Date(store.fullRangeStart),
          endDate: new Date(store.fullRangeEnd),
          selectedRangeMonths: store.totalMonths
        });
        return;
      }
      const months = store.dateRange.selectedRangeMonths;
      if (months === store.effectiveTotalMonths) {
        store.updateDateRange({
          startDate: new Date(store.effectiveFullRangeStart),
          endDate: new Date(store.effectiveFullRangeEnd),
          selectedRangeMonths: months
        });
        return;
      }
      if (months === 1) {
        let endDate = store.dateRange.endDate || new Date(store.effectiveFullRangeEnd);
        let startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        let computedEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
        store.updateDateRange({ startDate, endDate: computedEnd, selectedRangeMonths: 1 });
        return;
      }
      let endDate = store.dateRange.endDate || new Date(store.effectiveFullRangeEnd);
      let startDate = new Date(endDate);
      startDate.setMonth(endDate.getMonth() - (months - 1));
      if (startDate < new Date(store.effectiveFullRangeStart)) {
        startDate = new Date(store.effectiveFullRangeStart);
        endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + (months - 1));
        store.updateDateRange({ startDate, endDate, selectedRangeMonths: months });
      } else if (endDate > new Date(store.effectiveFullRangeEnd)) {
        endDate = new Date(store.effectiveFullRangeEnd);
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - (months - 1));
        store.updateDateRange({ startDate, endDate, selectedRangeMonths: months });
      } else {
        store.updateDateRange({ startDate, endDate, selectedRangeMonths: months });
      }
    }
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
      toggleGraphMode,
      containerClick,
      handleHistogramClick: () => {},
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
      computedYearLabels
    };
  }
};
</script>

<style scoped>
.histogram-scroll-container {
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.histogram-scroll-container::-webkit-scrollbar {
  display: none;
}
.histogram-bar {
  display: inline-block;
  width: 3px;
  margin-right: 4px;
  background-color: #007bff;
}
.year-labels {
  position: relative;
  margin-top: 4px;
  height: 1.2rem;
}
.year-label {
  position: absolute;
  font-size: 0.8rem;
  cursor: pointer;
}
.year-label.highlighted {
  font-weight: bold;
}
.histogram-tooltip {
  position: absolute;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 10;
}
</style>


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
  margin-bottom: 15px;
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
}
.histogram-scroll-container {
  display: inline-block;
  position: relative;
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
.histogram-bar.active:not(.in-range) {
  opacity: 0.5;
}
.year-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-top: 4px;
}
.year-label {
  flex: 1 0 auto;
  min-width: 84px;
  text-align: center;
  cursor: pointer;
  user-select: none;
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
.date-slider-container > .histogram-wrapper {
  margin-bottom: 75px;
  padding-top: 20px;
}

/* noUiSlider rules for date slider */ 
.date-slider-container ::v-deep .noUi-target {
  background-color: transparent;
}
.date-slider-container ::v-deep .noUi-horizontal .noUi-handle {
  cursor: pointer;
  width: 15px;
  right: -8px;
}
.date-slider-container ::v-deep .noUi-horizontal .noUi-handle::after,
.date-slider-container ::v-deep .noUi-horizontal .noUi-handle::before {
  display: none;
}

.date-slider-container.disabled {
  opacity: 0.5;
}

 
@media (max-width: 980px) {
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
  .control-buttons-row > button {
    position: fixed;
    left: 20px;
    bottom: 20px;
    z-index: 999;
    padding: 8px 12px;
    background-color: black;
    border: 1px solid white;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
  }
  .filter-checkbox {
    position: fixed;
    bottom: 20px;
    left: 100px;
  }
}
</style>