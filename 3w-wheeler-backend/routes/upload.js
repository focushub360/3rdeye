// routes/upload.js
import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { uploadToCloudinary } from '../services/cloudinaryService.js';
import File from '../models/File.js';
import { authenticate, hasPermission } from '../middleware/auth.js';

const router = express.Router();

// Direct upload handler supporting both Cloudinary and MongoDB GridFS fallback
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

const handleDirectUpload = async (req, res) => {
  try {
    const file = req.file || (req.files && (req.files.file || req.files.image || Object.values(req.files)[0]));
    if (!file) {
      console.warn('[DIRECT UPLOAD] No file in request');
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const { category = 'forms' } = req.body || {};
    const originalFilename = file.originalname || file.name || `upload_${Date.now()}`;
    const buffer = file.buffer || file.data;
    const mimetype = file.mimetype || 'image/jpeg';
    
    // 1. First try Cloudinary if credentials are configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        console.log(`[DIRECT UPLOAD] Attempting Cloudinary upload for ${originalFilename}...`);
        const result = await uploadToCloudinary(buffer, originalFilename, `focus_forms/${category}`);
        if (result && result.secure_url) {
          console.log(`[DIRECT UPLOAD] Cloudinary upload successful:`, result.secure_url);
          return res.json({
            success: true,
            publicUrl: result.secure_url,
            url: result.secure_url,
            key: result.public_id,
            format: result.format,
            bytes: result.bytes
          });
        }
      } catch (cloudErr) {
        console.warn(`[DIRECT UPLOAD] Cloudinary upload failed (${cloudErr.message}), falling back to MongoDB GridFS storage...`);
      }
    }

    // 2. Fallback: Save directly to MongoDB GridFS
    console.log(`[DIRECT UPLOAD] Storing file ${originalFilename} in MongoDB GridFS...`);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    const uniqueFilename = `${Date.now()}_${originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const uploadStream = bucket.openUploadStream(uniqueFilename, {
      contentType: mimetype,
      metadata: { originalName: originalFilename, category }
    });

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    await new Promise((resolve, reject) => {
      readable.pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    // Save File record in DB
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}/api`;

    const fileRecord = new File({
      filename: uniqueFilename,
      originalName: originalFilename,
      mimetype: mimetype,
      size: buffer.length,
      gridfsId: uploadStream.id,
      url: `${baseUrl}/files/${uploadStream.id}`,
      associatedWith: { type: 'form', id: category },
      isPublic: true
    });
    await fileRecord.save();

    const fileUrl = `${baseUrl}/files/${fileRecord._id}`;
    console.log(`[DIRECT UPLOAD] Stored in MongoDB GridFS successfully. Access URL: ${fileUrl}`);

    return res.json({
      success: true,
      publicUrl: fileUrl,
      url: fileUrl,
      key: fileRecord._id.toString(),
      format: mimetype.split('/')[1] || 'jpeg',
      bytes: buffer.length
    });
  } catch (error) {
    console.error('[DIRECT UPLOAD] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
};

router.post('/direct', uploadMiddleware.single('file'), handleDirectUpload);
router.put('/direct', uploadMiddleware.single('file'), handleDirectUpload);

// File type validation
const ALLOWED_FILE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/plain': 'txt'
};

const CATEGORIES = {
  avatars: { maxSize: 5 * 1024 * 1024, path: 'avatars/' },
  forms: { maxSize: 25 * 1024 * 1024, path: 'forms/' },
  templates: { maxSize: 10 * 1024 * 1024, path: 'templates/' },
  exports: { maxSize: 50 * 1024 * 1024, path: 'exports/' },
  evidence: { maxSize: 25 * 1024 * 1024, path: 'evidence/' },
  chat: { maxSize: 25 * 1024 * 1024, path: 'chat/' }
};

const s3Client = (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.S3_BUCKET_NAME) 
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    })
  : null;

router.post('/presigned-url', async (req, res) => {
  try {
    if (!s3Client) {
      return res.json({
        success: true,
        useDirectUpload: true,
        message: 'Direct upload mode enabled'
      });
    }

    const { fileName, fileType, fileSize, category = 'forms' } = req.body;

    if (!fileName || !fileType || !fileSize) {
      return res.status(400).json({
        success: false,
        error: 'fileName, fileType, and fileSize are required'
      });
    }

    if (!ALLOWED_FILE_TYPES[fileType]) {
      return res.status(400).json({
        success: false,
        error: 'File type not allowed'
      });
    }

    const categoryConfig = CATEGORIES[category] || CATEGORIES.forms;
    if (fileSize > categoryConfig.maxSize) {
      return res.status(400).json({
        success: false,
        error: `File size exceeds limit of ${categoryConfig.maxSize / (1024 * 1024)}MB`
      });
    }

    const extension = ALLOWED_FILE_TYPES[fileType];
    const uniqueId = uuidv4();
    const key = `${categoryConfig.path}${uniqueId}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: fileType
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = process.env.CLOUDFRONT_URL 
      ? `${process.env.CLOUDFRONT_URL}/${key}`
      : `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    res.json({
      success: true,
      uploadUrl,
      publicUrl,
      key
    });
  } catch (error) {
    console.error('Presigned URL error:', error);
    res.json({
      success: true,
      useDirectUpload: true,
      message: 'Falling back to direct upload'
    });
  }
});

export default router;
