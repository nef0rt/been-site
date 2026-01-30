// api/index.js - МИНИМАЛЬНЫЙ РАБОЧИЙ API
export default async function handler(req, res) {
  console.log('🚀 API called!');
  
  try {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Если OPTIONS запрос - сразу отвечаем
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    const { action } = req.query;
    console.log('Action:', action, 'Body:', req.body);
    
    // ПРОСТОЙ ТЕСТ
    if (!action) {
      return res.status(200).json({
        message: '✅ API работает!',
        timestamp: new Date().toISOString(),
        actions: ['register', 'login', 'test']
      });
    }
    
    // ТЕСТОВЫЙ ЭНДПОИНТ
    if (action === 'test') {
      return res.status(200).json({
        success: true,
        message: 'API тест пройден!',
        time: new Date().toISOString()
      });
    }
    
    // ПРОСТАЯ РЕГИСТРАЦИЯ (без базы)
    if (action === 'register') {
      const { username, password } = req.body || {};
      
      if (!username || !password) {
        return res.status(400).json({
          error: 'Нужны имя пользователя и пароль',
          received: { username, password }
        });
      }
      
      // Просто возвращаем успех
      return res.status(200).json({
        success: true,
        message: `Пользователь ${username} зарегистрирован!`,
        user: {
          username,
          id: Date.now().toString(),
          role: 'user',
          createdAt: new Date().toISOString()
        },
        isAdmin: false,
        note: 'Режим тестирования - данные не сохраняются'
      });
    }
    
    // ПРОСТОЙ ВХОД
    if (action === 'login') {
      const { username, password } = req.body || {};
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Нужны имя и пароль' });
      }
      
      // Всегда успешный вход для теста
      return res.status(200).json({
        success: true,
        message: `Добро пожаловать, ${username}!`,
        user: {
          username,
          id: 'test123',
          role: 'user',
          isMuted: false
        },
        isAdmin: username.toLowerCase().includes('admin')
      });
    }
    
    // Неизвестное действие
    return res.status(404).json({
      error: 'Неизвестное действие',
      action: action,
      help: 'Используйте: register, login, test'
    });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    
    return res.status(500).json({
      error: 'Внутренняя ошибка',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
