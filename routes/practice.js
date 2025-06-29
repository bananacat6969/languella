
const express = require('express');
const axios = require('axios');
const { supabaseAdmin } = require('../config/supabase');
const { authenticateToken } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Get daily review words
router.get('/daily-review', authenticateToken, async (req, res) => {
  try {
    // Get words that need review (prioritize by strength and last practiced date)
    const { data: vocabulary, error } = await supabaseAdmin
      .from('vocabulary')
      .select('*')
      .eq('user_id', req.user.id)
      .or('last_practiced_at.is.null,last_practiced_at.lt.' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('strength', { ascending: true })
      .order('last_practiced_at', { ascending: true, nullsFirst: true })
      .limit(20);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ vocabulary });
  } catch (error) {
    console.error('Get daily review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate practice sentences using vocabulary words
router.post('/generate-sentences', authenticateToken, [
  body('vocabulary_ids').isArray().isLength({ min: 1, max: 10 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { vocabulary_ids } = req.body;

  try {
    // Get vocabulary words
    const { data: vocabulary, error } = await supabaseAdmin
      .from('vocabulary')
      .select('word, translation, language')
      .in('id', vocabulary_ids)
      .eq('user_id', req.user.id);

    if (error || !vocabulary.length) {
      return res.status(400).json({ error: 'Invalid vocabulary words' });
    }

    // Get user's study language and difficulty
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('study_language, difficulty_level')
      .eq('id', req.user.id)
      .single();

    const studyLanguage = profile?.study_language || 'Spanish';
    const difficultyLevel = profile?.difficulty_level || 'beginner';

    const words = vocabulary.map(v => v.word).join(', ');

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: `Create 5 practice sentences in ${studyLanguage} at ${difficultyLevel} level using these vocabulary words: ${words}. 

For each sentence:
1. Create a fill-in-the-blank version (replace one of the vocabulary words with _____)
2. Provide the complete sentence
3. Provide English translation

Format as JSON:
{
  "exercises": [
    {
      "sentence_with_blank": "...",
      "complete_sentence": "...",
      "translation": "...",
      "missing_word": "..."
    }
  ]
}`
      }],
      max_tokens: 800,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL,
        'X-Title': 'Languella'
      }
    });

    const result = JSON.parse(response.data.choices[0].message.content);
    res.json(result);

  } catch (error) {
    console.error('Generate sentences error:', error);
    res.status(500).json({ error: 'Failed to generate practice sentences' });
  }
});

// Create study session
router.post('/sessions', authenticateToken, [
  body('session_type').isIn(['chat', 'flashcards', 'practice']),
  body('duration_minutes').optional().isInt({ min: 1, max: 480 }),
  body('words_practiced').optional().isInt({ min: 0 }),
  body('accuracy_score').optional().isFloat({ min: 0, max: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { session_type, duration_minutes, words_practiced, accuracy_score } = req.body;

  try {
    const { data: session, error } = await supabaseAdmin
      .from('study_sessions')
      .insert({
        user_id: req.user.id,
        session_type,
        duration_minutes,
        words_practiced,
        accuracy_score,
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get study sessions history
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('study_sessions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate quiz questions
router.post('/quiz', authenticateToken, [
  body('count').optional().isInt({ min: 1, max: 20 }),
  body('difficulty').optional().isIn(['beginner', 'intermediate', 'advanced'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { count = 10, difficulty } = req.body;

  try {
    // Get user vocabulary for quiz generation
    const { data: vocabulary, error } = await supabaseAdmin
      .from('vocabulary')
      .select('*')
      .eq('user_id', req.user.id)
      .order('times_practiced', { ascending: true })
      .limit(count * 2); // Get more words to have variety

    if (error || !vocabulary.length) {
      return res.status(400).json({ error: 'Not enough vocabulary words for quiz' });
    }

    // Get user's study language
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('study_language, difficulty_level')
      .eq('id', req.user.id)
      .single();

    const studyLanguage = profile?.study_language || 'Spanish';
    const userDifficulty = difficulty || profile?.difficulty_level || 'beginner';

    // Create quiz questions using AI
    const vocabularyList = vocabulary.slice(0, count).map(v => 
      `${v.word} (${v.translation})`
    ).join('\n');

    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: `Create ${count} multiple choice quiz questions in ${studyLanguage} at ${userDifficulty} level using these vocabulary words:

${vocabularyList}

For each question, create:
1. A question in ${studyLanguage} (translation, definition, or usage)
2. 4 multiple choice answers (one correct, three distractors)
3. The correct answer index (0-3)

Format as JSON:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct_answer": 0,
      "explanation": "..."
    }
  ]
}`
      }],
      max_tokens: 1200,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL,
        'X-Title': 'Languella'
      }
    });

    const quiz = JSON.parse(response.data.choices[0].message.content);
    res.json(quiz);

  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

module.exports = router;
