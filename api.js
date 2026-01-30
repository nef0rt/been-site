// api.js - простой API для Vercel KV
import { createClient } from '@vercel/kv';

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
      password, // Для теста, в проде хэшируй!
      role: isFirstUser ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      isBanned: false
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
      if (user) users.push(user);
    }
    return users;
  }
};

export default async function handler(req, res) {
  // CORS разрешаем всем
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    if (action === 'register') {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Нужны имя и пароль' });
      }
      
      const existing = await usersDB.getUser(username);
      if (existing) {
        return res.status(400).json({ error: 'Имя занято' });
      }
      
      const user = await usersDB.createUser(username, password);
      
      return res.json({
        success: true,
        user: {
          username: user.username,
          role: user.role,
          id: user.id
        },
        isAdmin: user.role === 'admin'
      });
    }
    
    if (action === 'login') {
      const { username, password } = req.body;
      
      const user = await usersDB.getUser(username);
      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден' });
      }
      
      if (user.password !== password) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }
      
      if (user.isBanned) {
        return res.status(403).json({ error: 'Аккаунт забанен' });
      }
      
      return res.json({
        success: true,
        user: {
          username: user.username,
          role: user.role,
          id: user.id
        },
        isAdmin: user.role === 'admin'
      });
    }
    
    if (action === 'users' && req.headers['x-admin-key'] === 'secret123') {
      const users = await usersDB.getAllUsers();
      return res.json({ users });
    }
    
    res.status(404).json({ error: 'Неизвестное действие' });
    
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
  }
