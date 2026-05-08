import File from '../models/File.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/cloudinaryService.js';
import axios from 'axios';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to proxy external files to avoid CORS issues in frontend
export const proxyFile = async (req, res) => {
  try {
    let { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL is required'
      });
    }

    // Decode URL if needed
    url = decodeURIComponent(url);

    // Normalize Google Drive URLs
    if (url.includes('drive.google.com')) {
      const fileIdMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        url = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
    }

    console.log(`[PROXY] Fetching external file: ${url}`);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,application/pdf,*/*'
      },
      maxRedirects: 10
    });

    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Proxy file error:', error.message);
    
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `External server returned error: ${error.response.statusText}`,
        url: req.query.url
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to proxy file',
      error: error.message
    });
  }
};

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { associatedType: bodyAssociatedType, associatedId: bodyAssociatedId } = req.body;
    const { associatedType: queryAssociatedType, associatedId: queryAssociatedId } = req.query;

    const normalizeValue = (value) => {
      if (!value) return undefined;
      return Array.isArray(value) ? value[0] : value;
    };

    const rawAssociatedType = (normalizeValue(bodyAssociatedType) || normalizeValue(queryAssociatedType) || 'form').toString().toLowerCase();
    const typeMap = {
      form: 'form',
      response: 'response',
      profile: 'profile',
      logo: 'logo',
      tenant_logo: 'logo',
      general: 'form'
    };
    
    const associatedType = typeMap[rawAssociatedType] || 'form';
    const associatedId = normalizeValue(bodyAssociatedId) || normalizeValue(queryAssociatedId);

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.path, associatedType);

    // Create file record
    const file = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      cloudinaryUrl: result.url,
      cloudinaryPublicId: result.public_id,
      uploadedBy: req.user._id,
      tenantId: req.user.tenantId,
      associatedWith: {
        type: associatedType,
        id: associatedId
      }
    });

    await file.save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: file
    });

  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getFile = async (req, res) => {
  try {
    const { filename } = req.params;

    const fileRecord = await File.findOne({ 
      $or: [
        { filename },
        { cloudinaryUrl: { $regex: filename } }
      ]
    });

    if (!fileRecord || !fileRecord.cloudinaryUrl) {
      const localPath = path.join(__dirname, '../uploads', filename);
      
      if (fs.existsSync(localPath)) {
        return res.sendFile(localPath);
      }

      return res.status(404).json({
        success: false,
        message: 'File not found on cloud or local storage'
      });
    }

    res.redirect(fileRecord.cloudinaryUrl);

  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getFileInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findById(id);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }
    res.json({
      success: true,
      data: file
    });
  } catch (error) {
    console.error('Get file info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const fileRecord = await File.findById(id);

    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const isOwner = fileRecord.uploadedBy && fileRecord.uploadedBy.toString() === req.user._id.toString();

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own files.'
      });
    }

    if (fileRecord.cloudinaryPublicId) {
      try {
        await deleteFromCloudinary(fileRecord.cloudinaryPublicId);
      } catch (cloudinaryError) {
        console.warn('Cloudinary delete warning:', cloudinaryError);
      }
    }

    await File.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getFilesByUser = async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;
    
    const query = { uploadedBy: req.user._id };
    
    if (type) {
      query['associatedWith.type'] = type;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 }
    };

    const files = await File.find(query)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit);

    const total = await File.countDocuments(query);

    res.json({
      success: true,
      data: {
        files,
        pagination: {
          total,
          page: options.page,
          limit: options.limit,
          pages: Math.ceil(total / options.limit)
        }
      }
    });

  } catch (error) {
    console.error('Get files by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};