
const { supabaseAdmin } = require('../config/supabase');

async function initializeDatabase() {
  console.log('🚀 Initializing database...');
  
  try {
    // Check if tables exist by trying to query them
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (!error) {
      console.log('✅ Database tables already exist');
      return;
    }
    
    console.log('📊 Creating database schema...');
    
    // Note: Since we can't run SQL directly from Node.js with Supabase client,
    // the SQL schema should be manually executed in Supabase dashboard
    console.log('⚠️  Please run the SQL schema from supabase-schema.sql in your Supabase dashboard');
    console.log('   Go to: https://supabase.com/dashboard/project/mkxiedycngmaizgkkheo/sql');
    
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = { initializeDatabase };
