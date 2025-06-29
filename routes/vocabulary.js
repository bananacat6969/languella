
const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('./auth');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();

// Get vocabulary list
router.get('/', authenticateToken, [
  query('language').optional().trim(),
  query('tag').optional().trim(),
  query('strength').optional().isIn(['new', 'learning', 'known', 'mastered']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { language, tag, strength, limit = 50, offset = 0 } = req.query;

  try {
    let query = supabaseAdmin
      .from('vocabulary')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (language) {
      query = query.eq('language', language);
    }

    if (strength) {
      query = query.eq('strength', strength);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data: vocabulary, error } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ vocabulary });
  } catch (error) {
    console.error('Get vocabulary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add new vocabulary word
router.post('/', authenticateToken, [
  body('word').trim().isLength({ min: 1, max: 100 }),
  body('translation').trim().isLength({ min: 1, max: 200 }),
  body('context').optional().trim().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('language').trim().isLength({ min: 1, max: 50 }),
  body('part_of_speech').optional().trim().isLength({ max: 50 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { word, translation, context, tags = [], notes, language, part_of_speech } = req.body;

  try {
    const { data: vocabulary, error } = await supabaseAdmin
      .from('vocabulary')
      .insert({
        user_id: req.user.id,
        word: word.toLowerCase(),
        translation,
        context,
        tags,
        notes,
        language: language.toLowerCase(),
        part_of_speech
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Word already exists in your vocabulary' });
      }
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ vocabulary });
  } catch (error) {
    console.error('Add vocabulary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update vocabulary word
router.put('/:id', authenticateToken, [
  body('word').optional().trim().isLength({ min: 1, max: 100 }),
  body('translation').optional().trim().isLength({ min: 1, max: 200 }),
  body('context').optional().trim().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('notes').optional().trim().isLength({ max: 500 }),
  body('strength').optional().isIn(['new', 'learning', 'known', 'mastered']),
  body('part_of_speech').optional().trim().isLength({ max: 50 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const updates = {};
  const allowedFields = ['word', 'translation', 'context', 'tags', 'notes', 'strength', 'part_of_speech'];
  
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = field === 'word' ? req.body[field].toLowerCase() : req.body[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.updated_at = new Date().toISOString();

  try {
    const { data: vocabulary, error } = await supabaseAdmin
      .from('vocabulary')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!vocabulary) {
      return res.status(404).json({ error: 'Vocabulary word not found' });
    }

    res.json({ vocabulary });
  } catch (error) {
    console.error('Update vocabulary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete vocabulary word
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('vocabulary')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Vocabulary word deleted successfully' });
  } catch (error) {
    console.error('Delete vocabulary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get vocabulary tags
router.get('/tags', authenticateToken, async (req, res) => {
  try {
    const { data: vocabulary, error } = await supabaseAdmin
      .from('vocabulary')
      .select('tags')
      .eq('user_id', req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Extract unique tags
    const allTags = vocabulary.flatMap(item => item.tags || []);
    const uniqueTags = [...new Set(allTags)].sort();

    res.json({ tags: uniqueTags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Practice vocabulary (update strength based on performance)
router.post('/:id/practice', authenticateToken, [
  body('correct').isBoolean(),
  body('time_taken_seconds').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { correct, time_taken_seconds } = req.body;

  try {
    // Record the practice session
    await supabaseAdmin
      .from('flashcard_reviews')
      .insert({
        user_id: req.user.id,
        vocabulary_id: id,
        correct,
        time_taken_seconds
      });

    // Update vocabulary strength and practice stats
    const { data: vocabulary, error: vocabError } = await supabaseAdmin
      .from('vocabulary')
      .select('strength, times_practiced')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (vocabError || !vocabulary) {
      return res.status(404).json({ error: 'Vocabulary word not found' });
    }

    let newStrength = vocabulary.strength;
    
    // Simple strength progression logic
    if (correct) {
      switch (vocabulary.strength) {
        case 'new':
          newStrength = 'learning';
          break;
        case 'learning':
          if (vocabulary.times_practiced >= 3) {
            newStrength = 'known';
          }
          break;
        case 'known':
          if (vocabulary.times_practiced >= 7) {
            newStrength = 'mastered';
          }
          break;
      }
    } else {
      // If incorrect, demote strength
      switch (vocabulary.strength) {
        case 'mastered':
          newStrength = 'known';
          break;
        case 'known':
          newStrength = 'learning';
          break;
      }
    }

    const { data: updatedVocabulary, error: updateError } = await supabaseAdmin
      .from('vocabulary')
      .update({
        strength: newStrength,
        times_practiced: vocabulary.times_practiced + 1,
        last_practiced_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ vocabulary: updatedVocabulary });
  } catch (error) {
    console.error('Practice vocabulary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
