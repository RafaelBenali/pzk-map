<template>
  <div class="preloader">
    <button :class="{ 'close-preloader': true, pulse: pulseActive }" @click="$emit('closePreloader')">×</button>
    <div class="preloader-text">
      <p>Эта интерактивная карта политзаключённых наглядно показывает, насколько мало информации мы имеем о тех, кто лишён свободы по политическим мотивам.</p> 
      <p>Возможно, кто-то из этих людей находится рядом с вами и им нужна ваша помощь.</p>
      <p>Присоединяйтесь к проекту и помогите восполнить пробелы в знаниях о тех, кого репрессии заставили исчезнуть из поля зрения.</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PreloaderScreen',
  emits: ['closePreloader'],
  data() {
    return {
      pulseActive: false
    };
  },
  methods: {
    handleKeydown(event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        this.$emit('closePreloader');
      }
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown);
    // Enable the pulsing animation after 10 seconds (10000 milliseconds)
    setTimeout(() => {
      this.pulseActive = true;
    }, 10000);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  }
}
</script>

<style scoped>
.preloader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: black;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}
.close-preloader {
  position: absolute;
  top: 10px;
  left: 20px;
  font-size: 40px;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding:0;
  transition: ease all 0.5s;
}
.preloader-text {
  color: white;
  font-size: 20px;
  width: 800px;
  text-align: left;
}


@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(0.9);
  }
}
 
.pulse {
  animation: pulse 1.3s infinite;
}


@media (max-width: 1150px) {  
  .preloader-text{
    width: calc(100vw - 40px);
  }
  .close-preloader{
    left: auto;
    right: 20px;
  }
}
@media (max-width: 600px) { 
  .close-preloader { 
    font-size: 30px;
  }

.preloader-text { 
  font-size: 14px; 
}
}

</style>