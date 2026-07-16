const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let supabase = null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'factory-uploads';

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized for persistent cloud storage.');
  } catch (err) {
    console.error('Error initializing Supabase client:', err.message);
  }
}

/**
 * Uploads a local file to Supabase Storage if configured.
 * Automatically deletes the local temporary file after successful upload.
 * 
 * @param {Object} file - Multer file object
 * @param {string} folder - Destination folder in the bucket (e.g. 'payment-evidence', 'qc-photos', 'hr-documents')
 * @returns {Promise<boolean>} True if uploaded to cloud, false if skipped/failed (local fallback remains)
 */
const uploadToCloud = async (file, folder) => {
  if (!file) return false;
  if (!supabase) {
    // If Supabase is not configured, we keep the file locally
    return false;
  }

  try {
    const fileBuffer = fs.readFileSync(file.path);
    const objectPath = `${folder}/${file.filename}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(objectPath, fileBuffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Successfully uploaded to cloud. Delete the local temporary file.
    fs.unlink(file.path, (err) => {
      if (err) {
        console.warn(`Warning: Could not delete local temp file ${file.path}:`, err.message);
      }
    });

    return true;
  } catch (err) {
    console.error(`Supabase cloud upload failed for file ${file.filename}, falling back to local file system:`, err.message);
    return false;
  }
};

/**
 * Returns the public URL of a file in Supabase Storage.
 * 
 * @param {string} folder - Folder in the bucket (e.g. 'payment-evidence', 'qc-photos', 'hr-documents')
 * @param {string} filename - The filename
 * @returns {string|null} The public URL, or null if Supabase is not configured
 */
const getCloudUrl = (folder, filename) => {
  if (!supabase) return null;

  try {
    const objectPath = `${folder}/${filename}`;
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(objectPath);

    return data?.publicUrl || null;
  } catch (err) {
    console.error(`Failed to get public cloud URL for ${folder}/${filename}:`, err.message);
    return null;
  }
};

module.exports = {
  uploadToCloud,
  getCloudUrl,
};
