import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '未找到上传的文件，请选择图片文件' }, { status: 400 });
    }

    // Validate file type
    const mimeType = file.type || '';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: '请上传有效的图片格式文件 (JPG, PNG, WEBP, GIF)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Map upload category to Cloudinary folders
    const uploadType = (formData.get('type') as string) || 'dish';
    let targetFolder = 'restaurant_dishes';
    if (uploadType === 'qr') {
      targetFolder = 'restaurant_qrcodes';
    } else if (uploadType === 'logo') {
      targetFolder = 'restaurant_logos';
    }

    // Upload directly to Cloudinary
    const uploadResult = await uploadToCloudinary(buffer, targetFolder, file.name);

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      provider: 'cloudinary',
      message: '图片已成功上传至 Cloudinary 云端存储',
    });
  } catch (error: any) {
    console.error('Cloudinary API upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '上传至 Cloudinary 云存储失败: ' + (error?.message || '网络异常'),
      },
      { status: 500 }
    );
  }
}
