<template> 
    <button @click="openModal" class="how-to open-modal-button">?</button>
     
    <div v-if="isModalOpen" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-button" @click="closeModal">&times;</button>
        <h2>Как использовать карту</h2>
        <p>
          Для отбора данных используйте поиск по имени или номеру статьи и фильтры: «Имена», «Статьи», «Дела». 
          «Сбросить» убирает все фильтры и восстанавливает полный диапазон. 
        </p> 
        <p>
          Кнопка «Время» включает гистограмму и ползунки для выбора интервала: от одного месяца до всего периода, с возможностью щёлкать по столбикам или перематывать время слайдером (–8x до +8x). 
          Повторное нажатие «Время» возвращает к общему обзору. 
        </p> 
        <p>
          В модальном окне (после клика по маркеру) можно увидеть подробности: имя, фото, статьи, адрес и ссылку на старницу политзаключённых на сайте Мемориала.  
          Закрыть окно можно кнопкой «×» или кликом вне области окна.
        </p> 
      </div>
    </div>
</template>

<script>
export default {
  name: 'HowTo',
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
}
.how-to:hover{
  color: black;
  background-color: white;
}
</style>
