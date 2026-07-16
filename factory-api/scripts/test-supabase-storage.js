require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || 'factory-uploads';

console.log('=== Supabase Storage Integration Test ===\n');

// Step 1: Check env vars
console.log('1. Checking environment variables...');
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('   ❌ SUPABASE_URL or SUPABASE_KEY not set in .env');
  process.exit(1);
}
console.log(`   ✅ SUPABASE_URL = ${SUPABASE_URL}`);
console.log(`   ✅ SUPABASE_KEY = ${SUPABASE_KEY.slice(0, 15)}...`);
console.log(`   ✅ SUPABASE_BUCKET = ${BUCKET}`);

(async () => {
  try {
    // Step 2: Initialize client
    console.log('\n2. Initializing Supabase client...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('   ✅ Client created');

    // Step 3: Test upload
    console.log('\n3. Uploading test file...');
    const testContent = Buffer.from(`Factory Storage Test - ${new Date().toISOString()}`);
    const testPath = 'test/storage-test.txt';

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(testPath, testContent, {
        contentType: 'text/plain',
        upsert: true,
      });

    if (uploadError) {
      console.error('   ❌ Upload failed:', uploadError.message);
      process.exit(1);
    }
    console.log('   ✅ Upload successful:', uploadData.path);

    // Step 4: Get public URL
    console.log('\n4. Getting public URL...');
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(testPath);

    console.log('   ✅ Public URL:', urlData.publicUrl);

    // Step 5: List files in bucket
    console.log('\n5. Listing bucket contents...');
    const { data: listData, error: listError } = await supabase.storage
      .from(BUCKET)
      .list('test');

    if (listError) {
      console.error('   ❌ List failed:', listError.message);
    } else {
      console.log(`   ✅ Found ${listData.length} file(s) in test/:`);
      listData.forEach(f => console.log(`      - ${f.name} (${f.metadata?.size || '?'} bytes)`));
    }

    // Step 6: Cleanup test file
    console.log('\n6. Cleaning up test file...');
    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove([testPath]);

    if (deleteError) {
      console.warn('   ⚠️  Cleanup failed (non-critical):', deleteError.message);
    } else {
      console.log('   ✅ Test file cleaned up');
    }

    console.log('\n=== ✅ ALL CHECKS PASSED — Supabase Storage is working! ===\n');
  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    process.exit(1);
  }
})();
