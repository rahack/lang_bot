module.exports = {
  keyboards: {
    translate: {
      inline_keyboard: [
        [{ text: 'RU → DE', callback_data: 'dir_ru-de' }, { text: 'DE → RU', callback_data: 'dir_de-ru' }]
      ]
    },
    gender: {
      inline_keyboard: [
        [{ text: 'Мужской', callback_data: 'gender_male' }, { text: 'Женский', callback_data: 'gender_female' }]
      ]
    },
    main: {
      keyboard: [
        [{ text: '/start' }, { text: '/translate' }, { text: '/chat' }, { text: '/check' }, { text: '/clear' }]
      ]
    }
  },

  menu: [
    { command: 'start',     description: '🏠 Старт / главное меню' },
    { command: 'translate', description: '🌐 Перевод RU ↔ DE' },
    { command: 'chat',      description: '💬 Чат на немецком' },
    { command: 'check',     description: '🔍 Проверка грамматики' },
    { command: 'clear',     description: '🧹 Сбросить состояние' }
  ]
};
