// api/index.js - ПОЛНАЯ ВЕРСИЯ С АДМИНКОЙ
export default async function handler(req, res) {
  console.log('🚀 API called!');
  
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
    console.log('Action:', action, 'Body:', req.body);
    
    // ВРЕМЕННАЯ БАЗА В ПАМЯТИ
    // При перезапуске сервера сбросится - потом заменим на Vercel KV
    let memoryDB = {
      users: {},
      admins: new Set(['admin']), // admin всегда админ
      banned: new Set(),
      muted: new Set()
    };
    
    // === ТЕСТ API ===
    if (!action) {
      return res.status(200).json({
        message: '✅ API работает!',
        timestamp: new Date().toISOString(),
        actions: ['register', 'login', 'users', 'ban', 'unban', 'mute', 'unmute', 'stats']
      });
    }
    
    // === РЕГИСТРАЦИЯ ===
    if (action === 'register') {
      const { username, password } = req.body || {};
      
      if (!username || !password) {
        return res.status(400).json({
          error: 'Нужны имя пользователя и пароль'
        });
      }
      
      if (username.length < 3) {
        return res.status(400).json({ error: 'Имя от 3 символов' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль от 6 символов' });
      }
      
      // Проверяем есть ли пользователь
      if (memoryDB.users[username]) {
        return res.status(400).json({ error: 'Имя занято' });
      }
      
      // Первый пользователь или имя с "admin" = админ
      const isFirstUser = Object.keys(memoryDB.users).length === 0;
      const hasAdminInName = username.toLowerCase().includes('admin');
      const isAdmin = isFirstUser || hasAdminInName;
      
      // Создаем пользователя
      const user = {
        username,
        id: Date.now().toString(),
        password, // ВНИМАНИЕ: в проде хэшируй!
        role: isAdmin ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        isBanned: false,
        isMuted: false,
        banReason: null,
        muteReason: null,
        bans: 0,
        lastLogin: new Date().toISOString()
      };
      
      // Сохраняем
      memoryDB.users[username] = user;
      if (isAdmin) {
        memoryDB.admins.add(username);
      }
      
      // Не отправляем пароль обратно!
      const { password: _, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${username} зарегистрирован!`,
        user: safeUser,
        isAdmin: isAdmin
      });
    }
    
    // === ВХОД ===
    if (action === 'login') {
      const { username, password } = req.body || {};
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Нужны имя и пароль' });
      }
      
      const user = memoryDB.users[username];
      
      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }
      
      if (user.password !== password) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      
      if (user.isBanned) {
        return res.status(403).json({ 
          error: 'Аккаунт забанен',
          reason: user.banReason || 'Нарушение правил'
        });
      }
      
      // Обновляем последний вход
      user.lastLogin = new Date().toISOString();
      memoryDB.users[username] = user;
      
      const { password: _, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: `Добро пожаловать, ${username}!`,
        user: safeUser,
        isAdmin: user.role === 'admin'
      });
    }
    
    // === ПОЛУЧИТЬ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (админ) ===
    if (action === 'users') {
      const { adminKey } = req.body || {};
      
      // Простая проверка админского ключа
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      const users = Object.values(memoryDB.users).map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      return res.status(200).json({
        success: true,
        users: users,
        stats: {
          totalUsers: users.length,
          admins: Array.from(memoryDB.admins).length,
          banned: Array.from(memoryDB.banned).length,
          muted: Array.from(memoryDB.muted).length
        }
      });
    }
    
    // === БАН ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'ban') {
      const { adminKey, targetUser, reason } = req.body || {};
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      if (!targetUser) {
        return res.status(400).json({ error: 'Укажите пользователя' });
      }
      
      const user = memoryDB.users[targetUser];
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Нельзя банить админов
      if (user.role === 'admin') {
        return res.status(400).json({ error: 'Нельзя банить админа' });
      }
      
      // Баним
      user.isBanned = true;
      user.banReason = reason || 'Нарушение правил';
      user.banDate = new Date().toISOString();
      user.bans = (user.bans || 0) + 1;
      memoryDB.users[targetUser] = user;
      memoryDB.banned.add(targetUser);
      
      const { password, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} забанен`,
        user: safeUser
      });
    }
    
    // === РАЗБАН ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'unban') {
      const { adminKey, targetUser } = req.body || {};
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      if (!targetUser) {
        return res.status(400).json({ error: 'Укажите пользователя' });
      }
      
      const user = memoryDB.users[targetUser];
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Разбаниваем
      user.isBanned = false;
      user.banReason = null;
      user.banDate = null;
      memoryDB.users[targetUser] = user;
      memoryDB.banned.delete(targetUser);
      
      const { password, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} разбанен`,
        user: safeUser
      });
    }
    
    // === МЬЮТ ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'mute') {
      const { adminKey, targetUser, reason, duration = 60 } = req.body || {};
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      if (!targetUser) {
        return res.status(400).json({ error: 'Укажите пользователя' });
      }
      
      const user = memoryDB.users[targetUser];
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Замьючиваем
      user.isMuted = true;
      user.muteReason = reason || 'Спам';
      user.muteStart = new Date().toISOString();
      user.muteDuration = duration;
      user.muteEnd = new Date(Date.now() + duration * 60000).toISOString();
      memoryDB.users[targetUser] = user;
      memoryDB.muted.add(targetUser);
      
      const { password, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} замьючен на ${duration} минут`,
        user: safeUser
      });
    }
    
    // === РАЗМЬЮТ ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'unmute') {
      const { adminKey, targetUser } = req.body || {};
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      if (!targetUser) {
        return res.status(400).json({ error: 'Укажите пользователя' });
      }
      
      const user = memoryDB.users[targetUser];
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Размьючиваем
      user.isMuted = false;
      user.muteReason = null;
      user.muteStart = null;
      user.muteEnd = null;
      memoryDB.users[targetUser] = user;
      memoryDB.muted.delete(targetUser);
      
      const { password, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} размьючен`,
        user: safeUser
      });
    }
    
    // === СТАТИСТИКА ===
    if (action === 'stats') {
      const users = Object.values(memoryDB.users);
      
      return res.status(200).json({
        success: true,
        stats: {
          totalUsers: users.length,
          admins: Array.from(memoryDB.admins).length,
          banned: Array.from(memoryDB.banned).length,
          muted: Array.from(memoryDB.muted).length,
          active: users.filter(u => !u.isBanned && !u.isMuted).length
        },
        users: users.map(u => ({
          username: u.username,
          role: u.role,
          isBanned: u.isBanned,
          isMuted: u.isMuted,
          createdAt: u.createdAt
        }))
      });
    }
    
    // Неизвестное действие
    return res.status(404).json({
      error: 'Неизвестное действие',
      action: action,
      help: 'Используйте: register, login, users, ban, unban, mute, unmute, stats'
    });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    
    return res.status(500).json({
      error: 'Внутренняя ошибка',
      message: error.message
    });
  }
  }
