import { uploadToS3, deleteFromS3 } from './s3Service.js';

/**
 * FAILSAFE: Redirects all Cloudinary calls to S3
 * This ensures that even if some old code still calls Cloudinary, it will use S3 instead.
 */
export const uploadToCloudinary = async (fileBuffer, filename, folder = 'focus_forms') => {
  console.log('[CLOUDINARY-MIGRATION] 🔄 Redirecting Cloudinary upload to S3');
  const result = await uploadToS3(fileBuffer, filename, folder);
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    ...result
  };
};

export const deleteFromCloudinary = async (publicId) => {
  console.log('[CLOUDINARY-MIGRATION] 🔄 Redirecting Cloudinary delete to S3');
  return await deleteFromS3(publicId);
};

export const generateCloudinarySignature = (params) => {
  console.warn('[CLOUDINARY-MIGRATION] ⚠️ Cloudinary signature requested but we are on S3');
  return 's3-migration-active';
};