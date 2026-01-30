// api/index.js - ПРОСТОЙ РАБОЧИЙ API БЕЗ KV
// Сохраняет в памяти + localStorage на клиенте

let memoryDB = {};

// Загружаем из глобальной переменной (сохраняем при каждом изменении)
if (typeof global.__been_russia_db !== 'undefined') {
  memoryDB = global.__been_russia_db;
} else {
  memoryDB = {
    users: {},
    // ТОЛЬКО ЭТИ НИКИ - АДМИНЫ
    ADMIN_USERS: ['admin', 'твой_ник', 'супер_админ'] // ← ЗАМЕНИ!
  };
  global.__been_russia_db = memoryDB;
}

export default async function handler(req, res) {
  console.log('🚀 API called:', req.query.action);
  
  try {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    const { action } = req.query;
    const body = req.body || {};
    
    // === РЕГИСТРАЦИЯ ===
    if (action === 'register') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Нужны имя и пароль' });
      }
      
      if (username.length < 3) {
        return res.status(400).json({ error: 'Имя от 3 символов' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль от 6 символов' });
      }
      
      // Проверяем есть ли пользователь
      if (memoryDB.users[username]) {
        return res.status(400).json({ error: 'Имя уже занято' });
      }
      
      // Определяем админ ли
      const isAdmin = memoryDB.ADMIN_USERS.includes(username.toLowerCase());
      
      // Создаем пользователя
      const user = {
        username,
        password, // ВНИМАНИЕ: в проде хэшируй!
        role: isAdmin ? 'admin' : 'user',
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        isBanned: false,
        isMuted: false,
        banReason: null,
        muteReason: null,
        bans: 0,
        lastLogin: null
      };
      
      // Сохраняем
      memoryDB.users[username] = user;
      
      if (isAdmin) {
        console.log(`👑 Новый админ: ${username}`);
      }
      
      // Не отправляем пароль!
      const { password: _, ...safeUser } = user;
      
      return res.json({
        success: true,
        message: `Регистрация успешна!`,
        user: safeUser,
        isAdmin: isAdmin
      });
    }
    
    // === ВХОД ===
    if (action === 'login') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Нужны имя и пароль' });
      }
      
      // Получаем пользователя
      const user = memoryDB.users[username];
      
      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }
      
      // Проверяем пароль
      if (user.password !== password) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      
      // Проверяем бан
      if (user.isBanned) {
        return res.status(403).json({ 
          error: 'Аккаунт забанен',
          reason: user.banReason || 'Нарушение правил'
        });
      }
      
      // Обновляем последний вход
      user.lastLogin = new Date().toISOString();
      memoryDB.users[username] = user;
      
      // Не отправляем пароль!
      const { password: _, ...safeUser } = user;
      
      return res.json({
        success: true,
        message: `Вход выполнен!`,
        user: safeUser,
        isAdmin: user.role === 'admin'
      });
    }
    
    // === ВСЕ ПОЛЬЗОВАТЕЛИ ===
    if (action === 'users') {
      const { adminKey } = body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      const users = Object.values(memoryDB.users).map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      const banned = users.filter(u => u.isBanned);
      const muted = users.filter(u => u.isMuted);
      const admins = users.filter(u => u.role === 'admin');
      
      return res.json({
        success: true,
        users: users,
        stats: {
          total: users.length,
          admins: admins.length,
          banned: banned.length,
          muted: muted.length
        }
      });
    }
    
    // === БАН ===
    if (action === 'ban') {
      const { adminKey, targetUser, reason } = body;
      
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
      
      const { password, ...safeUser } = user;
      
      return res.json({
        success: true,
        message: `Пользователь ${targetUser} забанен`,
        user: safeUser
      });
    }
    
    // === РАЗБАН ===
    if (action === 'unban') {
      const { adminKey, targetUser } = body;
      
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
      
      const { password, ...safeUser } = user;
      
      return res.json({
        success: true,
        message: `Пользователь ${targetUser} разбанен`,
        user: safeUser
      });
    }
    
    // Неизвестное действие
    return res.status(404).json({ error: 'Неизвестное действие' });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
         }
