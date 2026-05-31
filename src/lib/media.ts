export type MediaType = 'image' | 'video';

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i;

export function isVideoFile(file: File): boolean {
    return file.type.startsWith('video/');
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
    if (post.media_type === 'video') return 'video';
    if (post.media_type === 'image') return 'image';
    return isVideoUrl(post.image_url) ? 'video' : 'image';
}

export function isVideoPost(post: { media_type?: string | null; image_url?: string | null }): boolean {
    return getMediaTypeFromPost(post) === 'video';
}
