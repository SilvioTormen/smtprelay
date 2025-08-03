const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Simple user store
const users = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@example.com',
    password: null,
    role: 'admin'
  },
  {
    id: '2', 
    username: 'helpdesk',
    email: 'helpdesk@example.com',
    password: null,
    role: 'user'
  }
];

// Initialize passwords
const initializePasswords = async () => {
  try {
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@2025!Secure';
    const helpdeskPassword = process.env.HELPDESK_INITIAL_PASSWORD || 'Helpdesk@2025!Secure';
    
    users[0].password = await bcrypt.hash(adminPassword, 10);
    users[1].password = await bcrypt.hash(helpdeskPassword, 10);
    
    console.log('✅ Auth initialized successfully');
    console.log('   Default users: admin, helpdesk');
  } catch (error) {
    console.error('Failed to initialize auth:', error);
  }
};

// Initialize on startup
initializePasswords();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body.username);
    const { username, password } = req.body;
    
    // Validate input
    if (!username || !password) {
      console.log('Missing username or password');
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'Username and password are required' 
      });
    }
    
    // Find user
    const user = users.find(u => u.username === username);
    
    if (!user) {
      console.log('User not found:', username);
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }
    
    console.log('Login successful for:', username);
    
    // Generate token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Return success
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      token // Also return token for frontend if needed
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: error.message
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;