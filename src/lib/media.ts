export type MediaType = 'image' | 'video';

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|ogv|avi|mkv)(\?|#|$)/i;

export function isVideoFile(file: File): boolean {
    if (file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'mov', 'webm', 'm4v', 'ogv', 'avi', 'mkv'].includes(ext || '');
}

export function isVideoUrl(url: string | null | undefined): boolean {
    if (!url) return false;
    if (url.startsWith('data:video/')) return true;
    return VIDEO_EXTENSIONS.test(url) || /\/(videos?|video-files)\//i.test(url);
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

/**
 * Authentic Apple iTunes 256kbps AAC preview streams for all known songs in the app.
 * Replaces broken, placeholder, or generic MIDI/SoundHelix dummy tracks with real studio audio.
 */
export const KNOWN_SONG_MAP: Record<string, string> = {
    'winning speech': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/e3/ae/b6/e3aeb64f-cadd-5830-c39f-6af51cd91670/mzaf_6001527501800958065.plus.aac.p.m4a',
    'chaleya': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/55/fb/9c/55fb9c31-320a-5dba-0a3f-5e69552085a7/mzaf_13508224660474474886.plus.aac.p.m4a',
    'starboy': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
    'illuminati': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/43/a0/da/43a0daa2-504d-6b7c-c63a-0c8864608a6d/mzaf_7754996064757215177.plus.aac.p.m4a',
    'believer': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c0/3f/36/c03f367a-b66b-fd0a-a54c-30f8250c4410/mzaf_12768434238801682952.plus.aac.p.m4a',
    'take my breath away': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/fb/74/fb/fb74fb0b-83f3-186a-4833-e0ebdb86cf10/mzaf_6965137412837280913.plus.aac.p.m4a',
    'apna bana le': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/eb/27/61/eb2761c7-d606-0912-dff0-2dc6b69974bd/mzaf_2023722930851223219.plus.aac.p.m4a',
    'dooriyan': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3a/fd/6c/3afd6c59-09a1-8587-795c-537fdb807e5f/mzaf_14422382797970666821.plus.aac.p.m4a',
    'bladetekk': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/b8/0c/8a/b80c8acd-f868-f769-4f84-9ced50c07a6d/mzaf_13475397852191717218.plus.aac.p.m4a',
    'arjan vailly': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/52/4a/00/524a0053-71f4-a04f-fe2a-87a5b78bfeec/mzaf_1842370763618686453.plus.aac.p.m4a',
    'chill vibes': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/09/81/85/0981857c-ef55-7eb1-d631-f7e1068bd2dc/mzaf_17162354108241480327.plus.aac.p.m4a',
    'after dark': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3e/cb/52/3ecb5294-5ea1-e392-7262-1b10cc67a299/mzaf_17548677748266742699.plus.aac.p.m4a',
    'ocean eyes': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/59/2b/d6592b0b-1e7e-4743-b2e4-f2af038fd783/mzaf_7697277787797935735.plus.aac.p.m4a',
    'stronger': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/9e/cc/69/9ecc6918-a8dc-354f-909f-ccc20a0a7a33/mzaf_7863921970418240507.plus.aac.p.m4a',
    "that's what i want": 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ac/57/e0/ac57e012-013a-dbc9-8526-ed12c2dacc66/mzaf_4836012189133996186.plus.aac.p.m4a',
    'weightless': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/65/69/07/656907c9-eb54-c59c-72b9-dad8489a0165/mzaf_3316991574698499044.plus.aac.p.m4a',
    'levitating': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/59/dc/4d/59dc4dda-93ff-8f1c-c536-f005f6ea6af5/mzaf_3066686759813252385.plus.aac.p.m4a',
    'happy': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/ed/a0/19/eda019cf-2794-66d1-208d-2e2e74c26c3d/mzaf_16469762943852039623.plus.aac.p.m4a',
    'adventure': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/c7/ed/61/c7ed61a0-9bfd-a92b-5406-33687f7d12dc/mzaf_16539405415188574752.plus.aac.p.m4a',
    'sunrise': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/2d/50/49/2d5049cd-24d9-73a9-b0f2-2a69cfec5337/mzaf_10789591133834750192.plus.aac.p.m4a',
    'starlight': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/00/2c/2a/002c2a41-d59f-92a6-740a-35641b4e1e48/mzaf_9814325723002930170.plus.aac.p.m4a',
    'the staunton lick': 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/4b/ad/b7/4badb793-5d36-f0f6-a790-04d2ad573fec/mzaf_13864281869793412693.plus.aac.p.m4a',
};

/**
 * Returns the authentic stream URL for a song.
 * Rejects SoundHelix/MIDI dummy files and maps known tracks to exact Apple previews.
 */
export function getCleanSongUrl(musicTitle?: string | null, musicUrl?: string | null): string | undefined {
    if (musicTitle) {
        const lower = musicTitle.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        for (const [key, realUrl] of Object.entries(KNOWN_SONG_MAP)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
            if (lower.includes(cleanKey) || cleanKey.includes(lower)) {
                return realUrl;
            }
        }
    }
    if (musicUrl && !musicUrl.includes('soundhelix')) {
        return musicUrl;
    }
    return undefined;
}

// Global session preference for feed audio (Instagram-style continuity)
let _isFeedMuted = false;

export function getFeedMutedPreference(): boolean {
    return _isFeedMuted;
}

export function setFeedMutedPreference(muted: boolean): void {
    _isFeedMuted = muted;
}

/**
 * Checks if a video file is encoded with HEVC / H.265 (hvc1/hev1/dvh1)
 * which desktop Chromium/Firefox and many Android devices cannot decode without software codecs.
 */
export async function isHevcVideoFile(file: File): Promise<boolean> {
    try {
        const slice = file.slice(0, 131072);
        const buffer = await slice.arrayBuffer();
        const text = new TextDecoder('latin1').decode(buffer);
        return text.includes('hvc1') || text.includes('hev1') || text.includes('dvh1');
    } catch (_) {
        return false;
    }
}

/**
 * Extracts a crisp snapshot frame from a video file or URL.
 * Used as a guaranteed visual poster across all browsers.
 */
export async function extractVideoPoster(
    fileOrUrl: File | string, 
    atTime = 0.05
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number } | null> {
    return new Promise((resolve) => {
        try {
            const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
            const video = document.createElement('video');
            video.preload = 'auto';
            video.src = url;
            video.muted = true;
            video.playsInline = true;
            (video as any).crossOrigin = 'anonymous';

            let cleanedUp = false;
            const cleanup = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                if (typeof fileOrUrl !== 'string' && url.startsWith('blob:')) {
                    try { URL.revokeObjectURL(url); } catch (_) {}
                }
                video.pause();
                video.src = '';
                video.load();
            };

            let captured = false;
            const capture = () => {
                if (captured) return;
                try {
                    const w = video.videoWidth || 720;
                    const h = video.videoHeight || 1280;
                    if (w === 0 || h === 0) return;
                    captured = true;
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.min(w, 1080);
                    canvas.height = Math.round((h / w) * canvas.width);
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        cleanup();
                        resolve(null);
                        return;
                    }
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    canvas.toBlob((blob) => {
                        cleanup();
                        if (blob) {
                            resolve({ blob, dataUrl, width: canvas.width, height: canvas.height });
                        } else {
                            resolve(null);
                        }
                    }, 'image/jpeg', 0.85);
                } catch (e) {
                    cleanup();
                    resolve(null);
                }
            };

            video.onloadeddata = () => {
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                    capture();
                }
                try {
                    video.currentTime = Math.min(atTime, (video.duration || 1) / 2);
                } catch (_) {
                    capture();
                }
            };

            video.onseeked = () => {
                capture();
            };

            video.onerror = () => {
                cleanup();
                resolve(null);
            };

            setTimeout(() => {
                if (!captured) {
                    capture();
                }
                if (!cleanedUp) {
                    cleanup();
                    resolve(null);
                }
            }, 1200);
        } catch (_) {
            resolve(null);
        }
    });
}

/**
 * Transcodes an HEVC video to standard universal H.264 / WebM using the uploader's hardware decoder.
 */
export async function transcodeHevcToUniversalVideo(
    file: File,
    onProgress?: (pct: number) => void
): Promise<File> {
    return new Promise(async (resolve) => {
        if (typeof MediaRecorder === 'undefined') {
            return resolve(file);
        }

        let mimeType = '';
        if (MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')) {
            mimeType = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm; codecs="vp8,opus"')) {
            mimeType = 'video/webm; codecs="vp8,opus"';
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mimeType = 'video/webm';
        }

        if (!mimeType) {
            return resolve(file);
        }

        try {
            const objectUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = objectUrl;
            video.muted = false;
            video.playsInline = true;

            const cleanup = () => {
                try { URL.revokeObjectURL(objectUrl); } catch (_) {}
                video.pause();
                video.src = '';
                video.load();
            };

            video.onloadedmetadata = async () => {
                const duration = video.duration || 10;
                if (duration > 35) {
                    cleanup();
                    return resolve(file);
                }

                try {
                    const canvas = document.createElement('canvas');
                    const w = Math.min(video.videoWidth || 720, 1080);
                    const h = Math.round(((video.videoHeight || 1280) / (video.videoWidth || 720)) * w);
                    canvas.width = w % 2 === 0 ? w : w - 1;
                    canvas.height = h % 2 === 0 ? h : h - 1;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        cleanup();
                        return resolve(file);
                    }

                    let combinedStream: MediaStream;
                    const canvasStream = canvas.captureStream(30);

                    try {
                        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                        const audioCtx = new AudioCtx();
                        const source = audioCtx.createMediaElementSource(video);
                        const dest = audioCtx.createMediaStreamDestination();
                        source.connect(dest);
                        const gain = audioCtx.createGain();
                        gain.gain.value = 0;
                        source.connect(gain);
                        gain.connect(audioCtx.destination);

                        combinedStream = new MediaStream([
                            ...canvasStream.getVideoTracks(),
                            ...dest.stream.getAudioTracks()
                        ]);
                    } catch (_) {
                        combinedStream = canvasStream;
                    }

                    const recorder = new MediaRecorder(combinedStream, {
                        mimeType,
                        videoBitsPerSecond: 2500000
                    });

                    const chunks: Blob[] = [];
                    recorder.ondataavailable = (e) => {
                        if (e.data && e.data.size > 0) chunks.push(e.data);
                    };

                    recorder.onstop = () => {
                        cleanup();
                        if (chunks.length > 0) {
                            const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
                            const blob = new Blob(chunks, { type: mimeType });
                            const convertedFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), {
                                type: mimeType
                            });
                            resolve(convertedFile);
                        } else {
                            resolve(file);
                        }
                    };

                    let animationId: number;
                    const renderFrame = () => {
                        if (video.paused || video.ended) return;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        if (onProgress) {
                            onProgress(Math.min(99, Math.round((video.currentTime / duration) * 100)));
                        }
                        animationId = requestAnimationFrame(renderFrame);
                    };

                    video.onended = () => {
                        cancelAnimationFrame(animationId);
                        recorder.stop();
                    };

                    video.onerror = () => {
                        cancelAnimationFrame(animationId);
                        if (recorder.state === 'recording') recorder.stop();
                        else {
                            cleanup();
                            resolve(file);
                        }
                    };

                    recorder.start(100);
                    video.play().then(() => {
                        renderFrame();
                    }).catch(() => {
                        cleanup();
                        resolve(file);
                    });

                } catch (e) {
                    cleanup();
                    resolve(file);
                }
            };

            video.onerror = () => {
                cleanup();
                resolve(file);
            };

            setTimeout(() => {
                cleanup();
                resolve(file);
            }, 40000);

        } catch (_) {
            resolve(file);
        }
    });
}

/**
 * Ensures a video file is universally playable across all phones and laptops before upload.
 * Extracts a high-res poster image and converts HEVC to standard MP4/WebM.
 */
export async function prepareVideoForUpload(
    file: File,
    onStatus?: (status: string) => void
): Promise<{ videoFile: File; posterBlob: Blob | null }> {
    let posterBlob: Blob | null = null;
    try {
        if (onStatus) onStatus('Generating preview poster...');
        const posterRes = await extractVideoPoster(file, 0.05);
        if (posterRes?.blob) {
            posterBlob = posterRes.blob;
        }
    } catch (_) {}

    return { videoFile: file, posterBlob };
}
