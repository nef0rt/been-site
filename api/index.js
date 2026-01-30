// api/index.js - ТОЛЬКО УКАЗАННЫЕ ПОЛЬЗОВАТЕЛИ = АДМИНЫ
// База в памяти

let db = {
  users: {},
  // ⚠️ ВАЖНО: ТОЛЬКО ЭТИ НИКИ - АДМИНЫ (ЗАМЕНИ НА СВОИ!)
  ADMIN_USERS: ['admin', 'Nikita', 'Danielle'], // ← ЗАМЕНИ 'твой_ник_здесь' НА СВОЙ НИК!
  
  init() {
    // Предустановленные пользователи
    if (!this.users['admin']) {
      this.users['admin'] = {
        username: 'admin',
        password: 'administratorbeen606',
        role: 'admin', // ← ТОЛЬКО admin = АДМИН
        id: '1',
        createdAt: new Date().toISOString(),
        isBanned: false,
        isMuted: false,
        lastLogin: null
      };
    }
    
    if (!this.users['test']) {
      this.users['test'] = {
        username: 'test',
        password: 'test123',
        role: 'user', // ← test = ОБЫЧНЫЙ пользователь
        id: '2',
        createdAt: new Date().toISOString(),
        isBanned: false,
        isMuted: false,
        lastLogin: null
      };
    }
  }
};

db.init();

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
      if (db.users[username]) {
        return res.status(400).json({ error: 'Имя уже занято' });
      }
      
      // ⚠️ ВАЖНО: ТОЛЬКО если имя в списке ADMIN_USERS = админ
      const isAdmin = db.ADMIN_USERS.includes(username.toLowerCase());
      
      // Создаем пользователя
      const user = {
        username,
        password,
        role: isAdmin ? 'admin' : 'user', // ← здесь решается кто админ!
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
      db.users[username] = user;
      
      if (isAdmin) {
        console.log(`👑 Новый админ: ${username}`);
      } else {
        console.log(`👤 Новый пользователь: ${username}`);
      }
      
      // Не отправляем пароль!
      const { password: _, ...safeUser } = user;
      
      return res.json({
        success: true,
        message: `Регистрация успешна!`,
        user: safeUser,
        isAdmin: isAdmin // ← возвращаем false для обычных пользователей
      });
    }
    
    // === ВХОД ===
    if (action === 'login') {
      const { username, password } = body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Нужны имя и пароль' });
      }
      
      // Получаем пользователя
      const user = db.users[username];
      
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
      db.users[username] = user;
      
      // Не отправляем пароль!
      const { password: _, ...safeUser } = user;
      
      // ⚠️ ВАЖНО: Возвращаем реальную роль из базы
      return res.json({
        success: true,
        message: `Вход выполнен!`,
        user: safeUser,
        isAdmin: user.role === 'admin' // ← ТОЛЬКО если роль = 'admin'
      });
    }
    
    // === ВСЕ ПОЛЬЗОВАТЕЛИ ===
    if (action === 'users') {
      const { adminKey } = body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ error: 'Требуется ключ админа' });
      }
      
      const users = Object.values(db.users).map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      const banned = Object.values(db.users).filter(u => u.isBanned);
      const muted = Object.values(db.users).filter(u => u.isMuted);
      const admins = Object.values(db.users).filter(u => u.role === 'admin');
      
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
      
      const user = db.users[targetUser];
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
      db.users[targetUser] = user;
      
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
      
      const user = db.users[targetUser];
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Разбаниваем
      user.isBanned = false;
      user.banReason = null;
      user.banDate = null;
      db.users[targetUser] = user;
      
      const { password, ...safeUser } = user;
      
      return res.json({
        success: true,
        message: `Пользователь ${targetUser} разбанен`,
        user: safeUser
      });
    }
    
    // === ПРОВЕРКА АПИ ===
    if (action === 'test') {
      return res.json({
        success: true,
        message: 'API работает!',
        usersCount: Object.keys(db.users).length,
        admins: Object.values(db.users).filter(u => u.role === 'admin').map(u => u.username),
        adminList: db.ADMIN_USERS
      });
    }
    
    // Если action не указан
    if (!action) {
      return res.json({
        message: 'API работает!',
        actions: ['register', 'login', 'users', 'ban', 'test'],
        adminUsers: db.ADMIN_USERS
      });
    }
    
    // Неизвестное действие
    return res.status(404).json({ error: 'Неизвестное действие' });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    return res.status(500).json({ error: 'Ошибка сервера' });
  }
      }
