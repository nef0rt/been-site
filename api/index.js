// api/index.js - ПРОСТОЙ РАБОЧИЙ API
export default async function handler(req, res) {
  console.log('🚀 API called:', req.query.action);
  
  // ВАЖНО: CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // OPTIONS запрос
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { action } = req.query;
  
  // Пытаемся получить body
  let body = {};
  try {
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (e) {
    body = {};
  }
  
  // === ТЕСТ ===
  if (action === 'test') {
    return res.json({
      success: true,
      message: 'API работает!',
      time: new Date().toISOString()
    });
  }
  
  // === РЕГИСТРАЦИЯ ===
  if (action === 'register') {
    const { username, password } = body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Нужны имя и пароль' });
    }
    
    // Всегда успешная регистрация
    return res.json({
      success: true,
      message: 'Регистрация успешна!',
      user: {
        username,
        id: Date.now().toString(),
        role: 'user',
        createdAt: new Date().toISOString()
      },
      isAdmin: false
    });
  }
  
  // === ВХОД ===
  if (action === 'login') {
    const { username, password } = body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Нужны имя и пароль' });
    }
    
    // Всегда успешный вход
    return res.json({
      success: true,
      message: 'Вход выполнен!',
      user: {
        username,
        id: 'user_123',
        role: 'user',
        isMuted: false,
        isBanned: false
      },
      isAdmin: false
    });
  }
  
  // === ВСЕ ПОЛЬЗОВАТЕЛИ (админ) ===
  if (action === 'users') {
    const { adminKey } = body;
    
    if (adminKey !== 'secret123') {
      return res.status(403).json({ error: 'Требуется ключ админа' });
    }
    
    return res.json({
      success: true,
      users: [],
      stats: {
        total: 0,
        admins: 0,
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
    
    return res.json({
      success: true,
      message: `Пользователь ${targetUser} забанен`
    });
  }
  
  // === РАЗБАН ===
  if (action === 'unban') {
    const { adminKey, targetUser } = body;
    
    if (adminKey !== 'secret123') {
      return res.status(403).json({ error: 'Требуется ключ админа' });
    }
    
    return res.json({
      success: true,
      message: `Пользователь ${targetUser} разбанен`
    });
  }
  
  // === МЬЮТ ===
  if (action === 'mute') {
    const { adminKey, targetUser, reason } = body;
    
    if (adminKey !== 'secret123') {
      return res.status(403).json({ error: 'Требуется ключ админа' });
    }
    
    return res.json({
      success: true,
      message: `Пользователь ${targetUser} замьючен`
    });
  }
  
  // === РАЗМЬЮТ ===
  if (action === 'unmute') {
    const { adminKey, targetUser } = body;
    
    if (adminKey !== 'secret123') {
      return res.status(403).json({ error: 'Требуется ключ админа' });
    }
    
    return res.json({
      success: true,
      message: `Пользователь ${targetUser} размьючен`
    });
  }
  
  // Если action не указан
  if (!action) {
    return res.json({
      message: 'API работает!',
      actions: ['register', 'login', 'users', 'ban', 'mute', 'test']
    });
  }
  
  // Неизвестное действие
  return res.status(404).json({ error: 'Неизвестное действие' });
  }
