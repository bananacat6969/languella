
const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, [
  body('display_name').optional().trim().isLength({ min: 1, max: 50 }),
  body('study_language').optional().trim().isLength({ min: 1, max: 50 }),
  body('difficulty_level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('dark_mode').optional().isBoolean(),
  body('grammar_coloring').optional().isBoolean(),
  body('translation_overlay').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const updates = {};
  const allowedFields = ['display_name', 'study_language', 'difficulty_level', 'dark_mode', 'grammar_coloring', 'translation_overlay'];
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.updated_at = new Date().toISOString();

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Get basic profile stats
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('streak_count, total_words_learned, created_at')
      .eq('id', req.user.id)
      .single();

    // Get vocabulary count
    const { count: vocabularyCount } = await supabaseAdmin
      .from('vocabulary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    // Get conversation count
    const { count: conversationCount } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);

    // Get total study time (in minutes)
    const { data: sessions } = await supabaseAdmin
      .from('study_sessions')
      .select('duration_minutes')
      .eq('user_id', req.user.id);

    const totalStudyTime = sessions?.reduce((total, session) => total + (session.duration_minutes || 0), 0) || 0;

    // Get recent achievements
    const { data: achievements } = await supabaseAdmin
      .from('achievements')
      .select('*')
      .eq('user_id', req.user.id)
      .order('earned_at', { ascending: false })
      .limit(5);

    res.json({
      stats: {
        streak_count: profile?.streak_count || 0,
        total_words_learned: profile?.total_words_learned || 0,
        vocabulary_count: vocabularyCount || 0,
        conversation_count: conversationCount || 0,
        total_study_time: totalStudyTime,
        member_since: profile?.created_at
      },
      recent_achievements: achievements || []
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    // Delete user profile (this will cascade delete all related data due to foreign key constraints)
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
