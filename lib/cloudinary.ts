import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// Configure Cloudinary with environment variables or fallback to provided credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'hjljmaj3',
  api_key: process.env.CLOUDINARY_API_KEY || '237592361373693',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'VGqL4MU8viGjYy8a3aCfIrceqJs',
  secure: true,
});

export interface CloudinaryUploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * Upload a file Buffer directly to Cloudinary using upload_stream
 * @param buffer - File content Buffer
 * @param folder - Target Cloudinary folder (e.g. 'restaurant_dishes', 'restaurant_qrcodes', 'restaurant_logos')
 * @param originalFilename - Optional original file name
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string = 'restaurant_dishes',
  originalFilename?: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    // Generate clean public ID prefix without extension
    const cleanPublicId = originalFilename
      ? `${Date.now()}_${originalFilename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_')}`
      : `img_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: cleanPublicId,
        resource_type: 'image',
        overwrite: true,
        transformation: [
          { quality: 'auto', fetch_format: 'auto' }, // Cloudinary WebP/AVIF auto-format & lossless compression
        ],
      },
      (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
        if (error || !result) {
          console.error('[Cloudinary Upload Error]', error);
          reject(error || new Error('Cloudinary 上传无有效返回结果'));
        } else {
          resolve({
            url: result.url,
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}

export default cloudinary;
