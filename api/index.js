 // api/index.js - РАБОЧИЙ API
export default async function handler(req, res) {
  console.log('🚀 API called! Method:', req.method);
  
  try {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Если OPTIONS запрос
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    const { action } = req.query;
    console.log('Action:', action);
    
    // Пытаемся получить body
    let body = {};
    try {
      if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (e) {
      console.log('Body parse error:', e);
    }
    
    console.log('Body:', body);
    
    // === ЕСЛИ НЕТ ACTION - ПРИВЕТСТВИЕ ===
    if (!action) {
      return res.status(200).json({
        success: true,
        message: '✅ API работает!',
        timestamp: new Date().toISOString(),
        availableActions: ['register', 'login', 'users', 'ban', 'unban', 'mute', 'unmute']
      });
    }
    
    // === РЕГИСТРАЦИЯ ===
    if (action === 'register') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false,
          error: 'Нужны имя и пароль',
          received: { username, password }
        });
      }
      
      // Всегда успешная регистрация
      console.log(`📝 Регистрация: ${username}`);
      
      // ТОЛЬКО 'admin' = АДМИН (замени на свой ник!)
      const isAdmin = username.toLowerCase() === 'admin' || 
                      username.toLowerCase() === 'твой_ник'; // ← ЗДЕСЬ ТВОЙ НИК!
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${username} зарегистрирован!`,
        user: {
          username,
          id: Date.now().toString(),
          role: isAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString()
        },
        isAdmin: isAdmin
      });
    }
    
    // === ВХОД ===
    if (action === 'login') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false,
          error: 'Нужны имя и пароль' 
        });
      }
      
      console.log(`🔑 Вход: ${username}`);
      
      // Всегда успешный вход
      const isAdmin = username.toLowerCase() === 'admin' || 
                      username.toLowerCase() === 'твой_ник'; // ← И ЗДЕСЬ ТВОЙ НИК!
      
      return res.status(200).json({
        success: true,
        message: `Добро пожаловать, ${username}!`,
        user: {
          username,
          id: 'user_' + Date.now().toString(),
          role: isAdmin ? 'admin' : 'user',
          isMuted: false,
          isBanned: false
        },
        isAdmin: isAdmin
      });
    }
    
    // === ВСЕ ПОЛЬЗОВАТЕЛИ ===
    if (action === 'users') {
      const { adminKey } = body;
      
      // Простой ключ
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false,
          error: 'Требуется ключ админа' 
        });
      }
      
      return res.status(200).json({
        success: true,
        users: [
          { username: 'admin', role: 'admin', isBanned: false },
          { username: 'test', role: 'user', isBanned: false }
        ],
        stats: {
          totalUsers: 2,
          admins: 1,
          banned: 0,
          muted: 0
        }
      });
    }
    
    // === БАН ===
    if (action === 'ban') {
      const { adminKey, targetUser, reason } = body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} забанен`,
        reason: reason || 'Нарушение правил'
      });
    }
    
    // === МЬЮТ ===
    if (action === 'mute') {
      const { adminKey, targetUser, reason } = body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} замьючен`,
        reason: reason || 'Спам'
      });
    }
    
    // Неизвестное действие
    return res.status(404).json({
      success: false,
      error: 'Неизвестное действие',
      action: action,
      help: 'Используйте: register, login, users, ban, mute'
    });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка',
      message: error.message
    });
  }
                           }
