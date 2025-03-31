<template> 
    <button 
      @click="openModal" 
      :class="{ 'how-to': true, 'open-modal-button': true, pulse: pulseActive }">
      ?
    </button> 
    <div v-if="isModalOpen" class="modal how-to-modal" @click.self="closeModal">
      <div class="modal-content">
        
        <button class="close-button" @click="closeModal">&times;</button>
        <h2>Поиск и фильтрация данных</h2>
        <p>Найдите нужную информацию, используя поиск по имени или номеру статьи, а также фильтры: «Имена», «Статьи», «Дела». Кнопка «Сбросить» очищает все фильтры, восстанавливая полный диапазон данных и обновляя динамический счётчик политзаключённых (десктоп — в левом верхнем углу, мобильная версия — справа). При клике по счётчику отображается дата последнего обновления.</p>

        <h2>Интерактивное управление картой</h2>
        <p>В десктопной версии в правом верхнем углу находятся ползунок и кнопки «+» и «–» для масштабирования. На мобильной версии доступны только кнопки «+» и «–» в правом нижнем углу, а также стандартное управление жестами.</p>
        <p>Координаты мест заключения взяты с <a href="https://ospace.org/etap" target="_blank">«Карты этапирования заключённых»</a> Открытого Пространства  с дополнениями и исправлениями.</p>

        <h2>Временная гистограмма</h2>
        <p>Режим «Время» позволяет проследить динамику заключения политзаключённых. С помощью ползунков можно выбрать интервал – от одного месяца до полного периода.</p>
        <ul>
          <li>Клик по столбцу задаёт интервал в один месяц.</li>
          <li>Клик по году устанавливает временной диапазон в один год.</li>
        </ul>
        <p>Воспроизведение с регулируемой скоростью (от –3x до +3x) и возможностью паузы (пробел) помогает проанализировать изменения с течением времени.</p>

        <h2>Детальная информация</h2>
        <p>При клике на маркер открывается окно с подробными данными: имя, фото, ссылки на статьи, адрес и переход на страницу поддержки на сайте «Мемориал». Это позволяет узнать больше о судьбе каждого заключённого и, при необходимости, оказать помощь.</p>
 
        <h2>Недостаток знаний о местонахождении</h2>
        <p>Особое внимание уделяется тем, о ком известно слишком мало. Их маркеры отображаются первыми при загрузке карты и сгруппированы в виде решётки в сибирской тайге. Такой приоритетный показ не является ошибкой картографирования – это осознанное решение, демонстрирующее, насколько критична нехватка информации о судьбах политзаключённых. Это намеренный сигнал: карта не должна работать так, как сейчас, и этот функционал призывает исправить этот недостаток знаний. Для управления отображением этих маркеров предусмотрен отдельный чекбокс «Местоположение неизвестно», который позволяет включать или отключать их видимость.</p>

        <h2>Недостаток организованных групп поддержки</h2>
        <p>Организованные группы поддержки играют решающую роль в обеспечении системной помощи заключённым – от регулярной переписки до юридической и материальной поддержки. Однако таких групп слишком мало, что ещё больше усугубляет ситуацию узников, оставшихся без должного внимания. Чекбокс «Группа поддержки» позволяет фильтровать информацию по наличию поддержки, подчёркивая необходимость расширения этих инициатив. Более организованные и многочисленные группы поддержки могут существенно изменить жизнь людей за решёткой, облегчая их положение и давая им шанс на защиту прав.</p>
         
      </div>
    </div>
</template>

<script>
export default {
  name: 'HowTo',
  props: {
    // This prop should be set to true when the preloader is closed
    preloaderClosed: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isModalOpen: false,
      pulseActive: false,
      pulseTimeout: null,
      pulseStopTimeout: null,
      hasClicked: false
    }
  },
  methods: {
    openModal() {
      this.isModalOpen = true;
      this.hasClicked = true;
      // Cancel any pending pulse timers so the animation doesn't start or continue
      if (this.pulseTimeout) {
        clearTimeout(this.pulseTimeout);
        this.pulseTimeout = null;
      }
      if (this.pulseStopTimeout) {
        clearTimeout(this.pulseStopTimeout);
        this.pulseStopTimeout = null;
      }
      // Immediately remove any active pulsing
      this.pulseActive = false;
    },
    closeModal() {
      this.isModalOpen = false;
    },
    startPulseTimer() {
      // Only start pulsing if the button hasn't been clicked yet
      if (!this.hasClicked) {
        this.pulseTimeout = setTimeout(() => {
          if (!this.hasClicked) {
            this.pulseActive = true;
            // Stop pulsing after 10 seconds
            this.pulseStopTimeout = setTimeout(() => {
              this.pulseActive = false;
            }, 10000);
          }
        }, 5000);
      }
    }
  },
  watch: {
    // Watch for changes to preloaderClosed
    preloaderClosed(newVal) {
      if (newVal) {
        this.startPulseTimer();
      }
    }
  },
  mounted() {
    // In case the preloader is already closed when mounted, start the timer immediately
    if (this.preloaderClosed) {
      this.startPulseTimer();
    }
  },
  beforeUnmount() {
    if (this.pulseTimeout) {
      clearTimeout(this.pulseTimeout);
    }
    if (this.pulseStopTimeout) {
      clearTimeout(this.pulseStopTimeout);
    }
  }
}
</script>

<style scoped>
.how-to {
	background-color: rgba(0,0,0,.6);
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  position: absolute;
  right: 120px;
  width: 30px;
  color: white;
  text-align: center; 
  top: 10px;
  height: 30px;
  padding: 0;
  z-index: 16;
  transition: ease all 0.5s;
}
.how-to:hover{
  color: black;
  background-color: white;
}
.how-to-modal li{
  font-size: 12px;
  padding-left: 10px;
}
.how-to-modal .modal-content{
  width: 800px; 
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(0.95);
  }
}
 
.pulse {
  animation: pulse 1.3s infinite;
}


@media (max-width: 1150px) {  
  .how-to { 
    top: 130px;
    right: 10px;
  }
  .how-to-modal .modal-content{
    width: calc(100vw - 60px); 
  }
}
</style>
