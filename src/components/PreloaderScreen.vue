<template>
  <div class="preloader">
    <button class="close-preloader" @click="$emit('closePreloader')">×</button>
    <div class="preloader-text">
      О судьбе многих политзаключенных нет никакой информации
    </div>
  </div>
</template>

<script>
export default {
  name: 'PreloaderScreen',
  emits: ['closePreloader']
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
  top: 20px;
  right: 20px;
  font-size: 30px;
  background: none;
  border: none;
  color: white;
  cursor: pointer;
}
.preloader-text {
  color: white;
  font-size: 24px;
  text-align: center;
}
@media (max-width: 600px) {
  .preloader-text {
    font-size: 20px;
  }
  .close-preloader {
    top: 10px;
    right: 10px;
    font-size: 24px;
  }
}

</style>