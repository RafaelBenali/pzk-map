<template>
    <button @click="openModal" class="letters open-modal-button">✉</button>
       
    <div v-if="isModalOpen" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-button" @click="closeModal">&times;</button>
        <h2>Письма и открытки политзаключенным</h2>
        <p>Написать длинное письмо незнакомому человеку может казаться сложной задачей, но помните: даже краткое послание напоминает узникам, что они не одиноки. Ваше письмо – это не просто слова, это сигнал поддержки, который помогает сохранить связь с внешним миром и, возможно, обезопасить их положение.</p>
        <p>Поделитесь новостями, расскажите о том, что происходит, и добавьте немного юмора, если чувствуете, что это уместно. Если разворачивать целое письмо не получается, отправьте открытку – даже несколько строк могут подарить тепло и надежду.</p>
   
        <br>  
        <h3>Как отправить сообщение:</h3>
        <p>Отправляйте бумажное письмо или телеграмму, обязательно указывая индекс и адрес учреждения (СИЗО, колонии и т.д.), ФИО и дату рождения получателя.</p>
        <p>Не забудьте вложить конверт и марки, чтобы у заключённого была возможность ответить.</p>
        <ul> 
            <li>✓ <a href="https://f-pismo.ru/" target="_blank">ФСИН-письмо</a></li>
            <li>✓ <a href="https://www.zonatelecom.ru/" target="_blank">Зонателеком</a></li>
            <li>✓ <a href="https://rosuznik.org/" target="_blank">РосУзник</a></li>
        </ul> 
        <p>Важно: каждое ваше послание проходит через цензуру, поэтому не разглашайте информацию, которая может навредить получателю.</p>
 
      </div>
    </div> 
</template>

<script>
export default {
  name: 'Letters',
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
.letters {
	background-color: rgba(0,0,0,.6);
  border: 1px solid white;
  border-radius: 4px;
  cursor: pointer;
  position: absolute;
  left: 10px;
  width: 100px;
  color: white;
  text-align: center;
  top: 80px;
  height: 40px;
  padding: 0;
  font-size: 40px;
  line-height: 30px;
  z-index: 16;
}
.letters:hover{
  color: black;
  background-color: white;
}

@media (max-width: 1150px) {  
  .letters{
    right: 10px;
    left: auto;
  }
}
</style>