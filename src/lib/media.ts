export type MediaType = 'image' | 'video';

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|avi|mkv)(\?|$)/i;

export function isVideoFile(file: File): boolean {
    if (file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'mov', 'webm', 'm4v', 'ogv', 'avi', 'mkv'].includes(ext || '');
}

export function isVideoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    if (url.startsWith('data:video/')) return true;
    return VIDEO_EXTENSIONS.test(url) || /\/video\//i.test(url);
}

export function getMediaTypeFromFile(file: File): MediaType {
    return isVideoFile(file) ? 'video' : 'image';
}

export function getMediaTypeFromPost(post: { media_type?: string | null; image_url?: string | null }): MediaType {
    if (isVideoUrl(post.image_url)) return 'video';
    if (post.media_type === 'video') return 'video';
    return 'image';
}

export function isVideoPost(post: { media_type?: string | null; image_url?: string | null }): boolean {
    return getMediaTypeFromPost(post) === 'video';
}

/**
 * Optimizes image URLs (Unsplash, Pravatar, Supabase) by injecting width and quality query parameters.
 * Greatly speeds up page load time and reduces memory footprint.
 */
export function getOptimizedImageUrl(url: string | null | undefined, width = 600, quality = 75): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    try {
        if (url.includes('images.unsplash.com')) {
            const parsed = new URL(url);
            parsed.searchParams.set('w', width.toString());
            parsed.searchParams.set('q', quality.toString());
            parsed.searchParams.set('auto', 'format');
            parsed.searchParams.set('fit', 'crop');
            return parsed.toString();
        }
        if (url.includes('pravatar.cc')) {
            return url.replace(/\/\d+/, `/${Math.min(width, 150)}`);
        }
    } catch (e) {
        // Return original if parsing fails
    }
    return url;
}

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Resizes the image if it exceeds maxWidth/maxHeight, and outputs JPEG with specified quality.
 */
export function compressImage(
    file: File,
    maxWidth: number = 1200,
    maxHeight: number = 1200,
    quality: number = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            return resolve(file); // Not an image, return original file
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Failed to get 2D context from canvas.'));
                }

                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Export to Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return reject(new Error('Canvas compression failed.'));
                        }
                        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
                        const fileName = `${nameWithoutExt}.jpg`;
                        const compressedFile = new File([blob], fileName, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

