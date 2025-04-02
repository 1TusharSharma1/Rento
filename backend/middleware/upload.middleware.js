import multer from 'multer';
import multerS3 from 'multer-s3';
import { S3Client } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import path from 'path';
import ApiError from '../utils/ApiError.js';

/**
 * Initialize S3 client for AWS file storage
 * Uses environment variables for AWS credentials
 */
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * Upload configuration constants
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Configure multer with S3 storage for file uploads
 * Includes file type validation, size limitations, and unique filename generation
 */
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      // Generate unique filename to prevent collisions
      const fileExtension = path.extname(file.originalname);
      const fileName = path.basename(file.originalname, fileExtension);
      const uniqueString = crypto.randomBytes(8).toString('hex');
      const timestamp = Date.now();
      
      cb(null, `vehicles/${timestamp}-${fileName}-${uniqueString}${fileExtension}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Only allow specific image file types
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`), false);
    }
  },
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

/**
 * Middleware for handling vehicle image uploads
 * Processes up to 5 images, handles errors, and attaches processed file data to request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const uploadVehicleImages = (req, res, next) => {
  // Handle the file upload first
  upload.array('vehicleImages', 5)(req, res, async (err) => {
    try {
      if (err) {
        // Handle specific multer errors with clear messages
        if (err instanceof multer.MulterError) {
          switch (err.code) {
            case 'LIMIT_FILE_SIZE':
              throw new ApiError(400, `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
            case 'LIMIT_FILE_COUNT':
              throw new ApiError(400, 'Maximum 5 images allowed');
            case 'LIMIT_UNEXPECTED_FILE':
              throw new ApiError(400, 'Unexpected field name, use "vehicleImages"');
            default:
              throw new ApiError(400, `Upload error: ${err.message}`);
          }
        }
        throw new ApiError(400, err.message || 'File upload failed');
      }

      // Validate uploaded files after processing
      if (!req.files || req.files.length === 0) {
        throw new ApiError(400, 'No files were uploaded');
      }

      // Process and validate each file
      req.processedFiles = req.files.map(file => {
        if (!file.location || !file.key) {
          throw new ApiError(500, 'File upload to S3 failed');
        }
        console.log("Processed file:", file);
        return {
          url: file.location,
          key: file.key,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        };
      });

      next();
    } catch (error) {
      // Clean up any uploaded files if there's an error
      // This prevents orphaned files in S3 when request processing fails
      if (req.files && req.files.length > 0) {
        try {
          await Promise.all(req.files.map(file => 
            s3Client.deleteObject({
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: file.key
            })
          ));
        } catch (cleanupError) {
          console.error('Failed to cleanup S3 files:', cleanupError);
        }
      }

      next(error instanceof ApiError ? error : new ApiError(500, 'File processing failed'));
    }
  });
};

/**
 * Error handling middleware specifically for upload errors
 * Formats error responses for file upload failures
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} Error response for upload failures
 */
export const handleUploadErrors = (req, res, next) => {
  if (req.fileUploadError) {
    const err = req.fileUploadError;
    
    if (err instanceof multer.MulterError) {
      // Multer error occurred
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
        });
      }
      
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
    } else {
      // Other errors
      return res.status(400).json({
        success: false,
        message: err.message || 'An error occurred during file upload',
      });
    }
  }
  
  next();
}; 