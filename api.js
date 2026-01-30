// api.js - простой API для Vercel KV
import { createClient } from '@vercel/kv';

// Подключение к базе данных
const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// Простая база пользователей
const usersDB = {
  async getUser(username) {
    return await kv.get(`user:${username}`);
  },
  
  async createUser(username, password) {
    // Первый пользователь = админ
    const allUsers = await kv.keys('user:*');
    const isFirstUser = allUsers.length === 0;
    
    const user = {
      id: Date.now().toString(),
      username,
      password, // ВНИМАНИЕ: В реальном приложении используйте хэширование!
      role: isFirstUser ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      isBanned: false,
      isMuted: false,
      banReason: null,
      muteReason: null,
      bans: 0,
      lastLogin: new Date().toISOString()
    };
    
    await kv.set(`user:${username}`, user);
    await kv.sadd('users', username);
    
    if (isFirstUser) await kv.sadd('admins', username);
    
    return user;
  },
  
  async getAllUsers() {
    const users = [];
    const keys = await kv.keys('user:*');
    for (const key of keys) {
      const user = await kv.get(key);
      if (user) {
        // Не отправляем пароли клиенту!
        const { password, ...safeUser } = user;
        users.push(safeUser);
      }
    }
    return users;
  },
  
  async updateUser(username, updates) {
    const user = await this.getUser(username);
    if (!user) return null;
    
    Object.assign(user, updates);
    await kv.set(`user:${username}`, user);
    
    // Не возвращаем пароль
    const { password, ...safeUser } = user;
    return safeUser;
  },
  
  async banUser(username, reason) {
    return await this.updateUser(username, {
      isBanned: true,
      banReason: reason || 'Нарушение правил',
      banDate: new Date().toISOString(),
      bans: (await this.getUser(username))?.bans + 1 || 1
    });
  },
  
  async unbanUser(username) {
    return await this.updateUser(username, {
      isBanned: false,
      banReason: null,
      banDate: null
    });
  },
  
  async muteUser(username, reason, duration = 60) {
    const muteEnd = new Date();
    muteEnd.setMinutes(muteEnd.getMinutes() + duration);
    
    return await this.updateUser(username, {
      isMuted: true,
      muteReason: reason || 'Спам',
      muteStart: new Date().toISOString(),
      muteEnd: muteEnd.toISOString(),
      muteDuration: duration
    });
  },
  
  async unmuteUser(username) {
    return await this.updateUser(username, {
      isMuted: false,
      muteReason: null,
      muteStart: null,
      muteEnd: null
    });
  },
  
  async clearAll() {
    const keys = await kv.keys('*');
    for (const key of keys) {
      await kv.del(key);
    }
    return { success: true, cleared: keys.length };
  },
  
  async getStats() {
    const users = await kv.keys('user:*');
    const admins = await kv.smembers('admins') || [];
    const bannedUsers = [];
    
    for (const userKey of users) {
      const user = await kv.get(userKey);
      if (user?.isBanned) bannedUsers.push(user.username);
    }
    
    return {
      totalUsers: users.length,
      admins: admins.length,
      banned: bannedUsers.length,
      lastUpdated: new Date().toISOString()
    };
  }
};

// Основной обработчик API
export default async function handler(req, res) {
  // Разрешаем CORS для всех доменов
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Обработка предварительных запросов
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Получаем действие из query параметров
  const { action } = req.query;
  
  try {
    console.log(`API call: ${action}`, req.body);
    
    // === РЕГИСТРАЦИЯ ===
    if (action === 'register') {
      const { username, password } = req.body;
      
      // Валидация
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Поля обязательны',
          message: 'Имя пользователя и пароль обязательны' 
        });
      }
      
      if (username.length < 3) {
        return res.status(400).json({ 
          success: false, 
          error: 'Короткое имя',
          message: 'Имя должно быть не менее 3 символов' 
        });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          error: 'Короткий пароль',
          message: 'Пароль должен быть не менее 6 символов' 
        });
      }
      
      // Проверка существования пользователя
      const existingUser = await usersDB.getUser(username);
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Имя занято',
          message: 'Пользователь с таким именем уже существует' 
        });
      }
      
      // Создание пользователя
      const user = await usersDB.createUser(username, password);
      
      // Успешный ответ
      return res.status(200).json({
        success: true,
        message: 'Регистрация успешна!',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt
        },
        isAdmin: user.role === 'admin'
      });
    }
    
    // === ВХОД ===
    if (action === 'login') {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Поля обязательны',
          message: 'Введите имя пользователя и пароль' 
        });
      }
      
      const user = await usersDB.getUser(username);
      
      // Пользователь не найден
      if (!user) {
        return res.status(401).json({ 
          success: false, 
          error: 'Пользователь не найден',
          message: 'Неверное имя пользователя или пароль' 
        });
      }
      
      // Проверка пароля
      if (user.password !== password) {
        return res.status(401).json({ 
          success: false, 
          error: 'Неверный пароль',
          message: 'Неверное имя пользователя или пароль' 
        });
      }
      
      // Проверка бана
      if (user.isBanned) {
        return res.status(403).json({ 
          success: false, 
          error: 'Аккаунт забанен',
          message: 'Ваш аккаунт заблокирован',
          reason: user.banReason || 'Нарушение правил',
          banDate: user.banDate
        });
      }
      
      // Обновляем время последнего входа
      user.lastLogin = new Date().toISOString();
      await kv.set(`user:${username}`, user);
      
      // Успешный ответ (не отправляем пароль!)
      const { password: _, ...safeUser } = user;
      
      return res.status(200).json({
        success: true,
        message: 'Вход выполнен успешно!',
        user: safeUser,
        isAdmin: user.role === 'admin'
      });
    }
    
    // === ПОЛУЧИТЬ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (админ) ===
    if (action === 'users') {
      const { adminKey } = req.body;
      
      // Простая проверка админского ключа
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен',
          message: 'Требуется ключ администратора' 
        });
      }
      
      const users = await usersDB.getAllUsers();
      const stats = await usersDB.getStats();
      
      return res.status(200).json({
        success: true,
        users: users,
        stats: stats
      });
    }
    
    // === ЗАБАНИТЬ ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'ban') {
      const { adminKey, targetUser, reason } = req.body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен',
          message: 'Требуется ключ администратора' 
        });
      }
      
      if (!targetUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Укажите пользователя',
          message: 'Не указано имя пользователя' 
        });
      }
      
      const user = await usersDB.banUser(targetUser, reason);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Пользователь не найден',
          message: `Пользователь ${targetUser} не найден` 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} успешно забанен`,
        user: user
      });
    }
    
    // === РАЗБАНИТЬ ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'unban') {
      const { adminKey, targetUser } = req.body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен',
          message: 'Требуется ключ администратора' 
        });
      }
      
      if (!targetUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Укажите пользователя',
          message: 'Не указано имя пользователя' 
        });
      }
      
      const user = await usersDB.unbanUser(targetUser);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Пользователь не найден',
          message: `Пользователь ${targetUser} не найден` 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} успешно разбанен`,
        user: user
      });
    }
    
    // === ЗАМЬЮТИТЬ ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'mute') {
      const { adminKey, targetUser, reason, duration } = req.body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен',
          message: 'Требуется ключ администратора' 
        });
      }
      
      if (!targetUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Укажите пользователя',
          message: 'Не указано имя пользователя' 
        });
      }
      
      const muteDuration = parseInt(duration) || 60;
      const user = await usersDB.muteUser(targetUser, reason, muteDuration);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Пользователь не найден',
          message: `Пользователь ${targetUser} не найден` 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} замьючен на ${muteDuration} минут`,
        user: user
      });
    }
    
    // === РАЗМЬЮТИТЬ ПОЛЬЗОВАТЕЛЯ ===
    if (action === 'unmute') {
      const { adminKey, targetUser } = req.body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен',
          message: 'Требуется ключ администратора' 
        });
      }
      
      if (!targetUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'Укажите пользователя',
          message: 'Не указано имя пользователя' 
        });
      }
      
      const user = await usersDB.unmuteUser(targetUser);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Пользователь не найден',
          message: `Пользователь ${targetUser} не найден` 
        });
      }
      
      return res.status(200).json({
        success: true,
        message: `Пользователь ${targetUser} размьючен`,
        user: user
      });
    }
    
    // === СТАТИСТИКА ===
    if (action === 'stats') {
      const stats = await usersDB.getStats();
      
      return res.status(200).json({
        success: true,
        stats: stats
      });
    }
    
    // === ОЧИСТКА ВСЕХ ДАННЫХ ===
    if (action === 'clear') {
      const { adminKey } = req.body;
      
      if (adminKey !== 'secret123') {
        return res.status(403).json({ 
          success: false, 
          error: 'Доступ запрещен',
          message: 'Требуется ключ администратора' 
        });
      }
      
      const result = await usersDB.clearAll();
      
      return res.status(200).json({
        success: true,
        message: 'Все данные успешно очищены',
        cleared: result.cleared
      });
    }
    
    // === ПРОВЕРКА АДМИНА ===
    if (action === 'checkadmin') {
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ 
          success: false, 
          error: 'Укажите пользователя' 
        });
      }
      
      const user = await usersDB.getUser(username);
      const isAdmin = user?.role === 'admin';
      
      return res.status(200).json({
        success: true,
        isAdmin: isAdmin,
        user: user ? {
          username: user.username,
          role: user.role,
          isBanned: user.isBanned,
          isMuted: user.isMuted
        } : null
      });
    }
    
    // Неизвестное действие
    return res.status(404).json({
      success: false,
      error: 'Неизвестное действие',
      message: 'Действие не распознано',
      availableActions: ['register', 'login', 'users', 'ban', 'unban', 'mute', 'unmute', 'stats', 'clear', 'checkadmin']
    });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      message: 'Что-то пошло не так. Попробуйте позже.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
                 }
