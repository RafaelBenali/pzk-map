<template>
    <button @click="openModal" class="letters open-modal-button">✉</button>
       
    <div v-if="isModalOpen" class="modal" @click.self="closeModal">
      <div class="modal-content">
        <button class="close-button" @click="closeModal">&times;</button>
        <h2>Письма и открытки политзаключенным</h2>
        <p>Написать целое письмо, да еще и незнакомым людям, может быть непросто. Но помни, что любая весточка с воли напомнит, что они не одни. Также, наличие связи с внешним миром может их немного обезопасить.</p>
        <p>Попытайся поддержать их, расскажи им новости и просто поделись свежими мемами.</p>
        <p>Если сочинить письмо сразу не выходит, то отправь открытку.</p>
        <br>
        <h3>Где найти контакты:</h3>
        <ul>
            <li>✓ <a href="https://t.me/politzekam_bot" target="_blank">Напиши политзеку - @politzekam_bot</a></li>
            <li>✓ <a href="https://t.me/svobot_bot" target="_blank">СВОБОТ! - @svobot_bot</a></li>
            <li>✓ <a href="https://rosuznik.org/" target="_blank">РосУзник - rosuznik.org</a></li>
        </ul>
        <br>
        <h3>Как отправить:</h3>
        <p>Бумажное письмо или телеграмма. Укажи индекс и адрес (СИЗО, колонии и т.д.), ФИО и дату рождения получателей. Вложи конверт и марки, чтобы у них была возможность ответить.</p>
        <ul> 
            <li>✓ <a href="https://f-pismo.ru/" target="_blank">ФСИН-письмо</a></li>
            <li>✓ <a href="https://www.zonatelecom.ru/" target="_blank">Зонателеком</a></li>
            <li>✓ <a href="https://rosuznik.org/" target="_blank">РосУзник</a></li>
        </ul>
        <br>
        <p>Между вами будут стоять цензоры и проверять каждое сообщение, так что не выдавай ничего лишнего о себе и того, что может навредить тем, кому ты пишешь.</p>
 
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
}
.letters:hover{
  color: black;
  background-color: white;
}
</style>