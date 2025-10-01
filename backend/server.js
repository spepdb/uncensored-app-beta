import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============ MIDDLEWARE ============

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Moderator middleware  
const requireModerator = (req, res, next) => {
  if (!req.user || (!req.user.is_admin && !req.user.is_moderator)) {
    return res.status(403).json({ error: 'Moderator access required' });
  }
  next();
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', [
  body('displayName').isLength({ min: 1, max: 50 }),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], handleValidationErrors, async (req, res) => {
  try {
    const { displayName, username, email, password } = req.body;

    // Check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, username, email')
      .or(`username.eq.${username},email.eq.${email}`);

    if (existingUser && existingUser.length > 0) {
      const existingUsername = existingUser.find(u => u.username === username);
      const existingEmail = existingUser.find(u => u.email === email);
      
      if (existingUsername) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          display_name: displayName,
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password_hash: passwordHash,
          is_admin: false,
          is_moderator: false,
          is_verified: false,
          is_premium: false
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        is_admin: user.is_admin,
        is_moderator: user.is_moderator 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({ 
      user: userWithoutPassword, 
      token,
      message: 'User created successfully' 
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', [
  body('identifier').notEmpty(),
  body('password').notEmpty()
], handleValidationErrors, async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by username or email
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        is_admin: user.is_admin,
        is_moderator: user.is_moderator 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({ 
      user: userWithoutPassword, 
      token,
      message: 'Login successful' 
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ POST ROUTES ============

// Get all posts
app.get('/api/posts', async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(display_name, username, avatar_url, is_verified, is_premium),
        likes:likes(count)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format posts with like counts
    const formattedPosts = posts.map(post => ({
      ...post,
      likes_count: post.likes[0]?.count || 0
    }));

    res.json(formattedPosts);

  } catch (error) {
    console.error('Error loading posts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create post
app.post('/api/posts', authenticateToken, [
  body('content').isLength({ min: 1, max: 280 })
], handleValidationErrors, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    const { data: post, error } = await supabase
      .from('posts')
      .insert([{ 
        user_id: userId, 
        content: content.trim()
      }])
      .select(`
        *,
        user:users(display_name, username, avatar_url, is_verified, is_premium)
      `)
      .single();

    if (error) throw error;

    res.json(post);

  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Like post
app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const { data: like, error } = await supabase
      .from('likes')
      .insert([{ user_id: userId, post_id: postId }])
      .select()
      .single();

    if (error) throw error;

    res.json({ liked: true, like });

  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unlike post
app.delete('/api/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const { error } = await supabase
      .from('likes')
      .delete()
      .match({ user_id: userId, post_id: postId });

    if (error) throw error;

    res.json({ liked: false });

  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ USER ROUTES ============

// Get user profile
app.get('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        display_name,
        username,
        avatar_url,
        banner_url,
        bio,
        website,
        location,
        is_verified,
        is_premium,
        created_at
      `)
      .eq('username', username)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user stats
    const { data: posts } = await supabase
      .from('posts')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);

    const { data: followers } = await supabase
      .from('follows')
      .select('id', { count: 'exact' })
      .eq('following_id', user.id);

    const { data: following } = await supabase
      .from('follows')
      .select('id', { count: 'exact' })
      .eq('follower_id', user.id);

    res.json({
      ...user,
      posts_count: posts?.length || 0,
      followers_count: followers?.length || 0,
      following_count: following?.length || 0
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Follow user
app.post('/api/users/:username/follow', authenticateToken, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const followerId = req.user.id;

    // Get target user ID
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', targetUsername)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: follow, error } = await supabase
      .from('follows')
      .insert([{ 
        follower_id: followerId, 
        following_id: targetUser.id 
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ following: true, follow });

  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unfollow user
app.delete('/api/users/:username/follow', authenticateToken, async (req, res) => {
  try {
    const targetUsername = req.params.username;
    const followerId = req.user.id;

    // Get target user ID
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', targetUsername)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { error } = await supabase
      .from('follows')
      .delete()
      .match({ 
        follower_id: followerId, 
        following_id: targetUser.id 
      });

    if (error) throw error;

    res.json({ following: false });

  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN ROUTES ============

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: users, error, count } = await query;

    if (error) throw error;

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ban user
app.post('/api/admin/users/:id/ban', authenticateToken, requireAdmin, [
  body('reason').notEmpty(),
  body('duration_hours').isInt({ min: 1 })
], handleValidationErrors, async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason, duration_hours } = req.body;
    const adminId = req.user.id;

    // Update user
    const { error } = await supabase
      .from('users')
      .update({ 
        is_banned: true,
        banned_until: new Date(Date.now() + duration_hours * 3600000).toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert([{
        admin_id: adminId,
        target_user_id: userId,
        action_type: 'ban',
        reason: reason,
        duration_hours: duration_hours
      }]);

    res.json({ message: 'User banned successfully' });

  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unban user
app.post('/api/admin/users/:id/unban', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const adminId = req.user.id;

    const { error } = await supabase
      .from('users')
      .update({ 
        is_banned: false,
        banned_until: null
      })
      .eq('id', userId);

    if (error) throw error;

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert([{
        admin_id: adminId,
        target_user_id: userId,
        action_type: 'unban',
        reason: 'Manual unban by admin'
      }]);

    res.json({ message: 'User unbanned successfully' });

  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete post (admin/moderator)
app.delete('/api/admin/posts/:id', authenticateToken, requireModerator, async (req, res) => {
  try {
    const postId = req.params.id;
    const moderatorId = req.user.id;

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;

    // Log moderation action
    await supabase
      .from('moderation_actions')
      .insert([{
        moderator_id: moderatorId,
        target_post_id: postId,
        action_type: 'delete_post',
        reason: req.body.reason || 'Violation of community guidelines'
      }]);

    res.json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get platform analytics
app.get('/api/admin/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '7d' } = req.query; // 7d, 30d, 90d
    
    // User growth
    const { data: userStats } = await supabase
      .from('users')
      .select('created_at');

    // Post statistics
    const { data: postStats } = await supabase
      .from('posts')
      .select('created_at');

    // Revenue (placeholder for Monero integration)
    const revenueStats = {
      total_revenue: 0,
      premium_users: 0,
      conversion_rate: 0
    };

    res.json({
      user_growth: userStats?.length || 0,
      total_posts: postStats?.length || 0,
      active_today: Math.floor(Math.random() * 100) + 50, // Mock data
      revenue: revenueStats
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MODERATION ROUTES ============

// Get reported content
app.get('/api/moderation/reports', authenticateToken, requireModerator, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const { data: reports, error } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users!reporter_id(display_name, username),
        reported_user:users!reported_user_id(display_name, username),
        reported_post:posts(content, user_id)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(reports);

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve report
app.post('/api/moderation/reports/:id/resolve', authenticateToken, requireModerator, [
  body('action').isIn(['dismiss', 'warn', 'ban', 'delete']),
  body('notes').optional()
], handleValidationErrors, async (req, res) => {
  try {
    const reportId = req.params.id;
    const { action, notes } = req.body;
    const moderatorId = req.user.id;

    // Update report status
    const { error } = await supabase
      .from('reports')
      .update({ 
        status: 'resolved',
        resolved_by: moderatorId,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes
      })
      .eq('id', reportId);

    if (error) throw error;

    // Take action based on resolution
    if (action === 'ban') {
      // Implement ban logic
    } else if (action === 'delete') {
      // Implement content deletion
    }

    res.json({ message: 'Report resolved successfully' });

  } catch (error) {
    console.error('Error resolving report:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ HEALTH CHECK ============

app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    res.json({ 
      status: 'OK', 
      database: error ? 'Disconnected' : 'Connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Error', 
      error: error.message 
    });
  }
});

// ============ START SERVER ============

app.listen(PORT, () => {
  console.log('🚀 Social Platform Backend Started!');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`📊 Admin routes: /api/admin/*`);
  console.log(`🛡️ Mod routes: /api/moderation/*`);
});
