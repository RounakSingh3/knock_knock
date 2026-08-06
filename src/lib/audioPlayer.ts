// Universal Web Audio Player with browser autoplay unlock
class AudioPlayerService {
    private currentAudio: HTMLAudioElement | null = null;
    private currentUrl: string | null = null;

    constructor() {
        // Create a silent audio context unlock on first user interaction
        if (typeof window !== 'undefined') {
            const unlockAudio = () => {
                // Play a silent buffer to unlock audio on iOS/Safari
                try {
                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const buffer = ctx.createBuffer(1, 1, 22050);
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    source.connect(ctx.destination);
                    source.start(0);
                    ctx.resume().catch(() => {});
                } catch (e) {}
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('touchstart', unlockAudio);
                window.removeEventListener('touchend', unlockAudio);
            };
            window.addEventListener('click', unlockAudio, { capture: true });
            window.addEventListener('touchstart', unlockAudio, { capture: true });
            window.addEventListener('touchend', unlockAudio, { capture: true });
        }
    }

    public play(url: string, loop: boolean = true): HTMLAudioElement | null {
        if (!url) return null;

        // If already playing the same track, don't restart
        if (this.currentAudio && this.currentUrl === url && !this.currentAudio.paused) {
            return this.currentAudio;
        }

        // Stop any existing track first
        this.stop();

        try {
            const audio = new Audio();
            // Do NOT set crossOrigin - iTunes/Apple CDN URLs don't support CORS headers
            // and setting it causes the request to fail silently
            audio.preload = 'auto';
            audio.loop = loop;
            audio.volume = 1.0;
            audio.src = url;

            // Use a user-interaction-safe play approach
            const tryPlay = () => {
                const promise = audio.play();
                if (promise !== undefined) {
                    promise.catch((err) => {
                        // If autoplay is blocked, try again on next user tap
                        console.warn('[AudioPlayer] Autoplay blocked, will retry on tap:', err.message);
                        const retryPlay = () => {
                            audio.play().catch(() => {});
                            window.removeEventListener('click', retryPlay);
                            window.removeEventListener('touchstart', retryPlay);
                        };
                        window.addEventListener('click', retryPlay, { once: true });
                        window.addEventListener('touchstart', retryPlay, { once: true });
                    });
                }
            };

            // If audio is ready, play immediately; otherwise wait for it to load
            if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
                tryPlay();
            } else {
                audio.addEventListener('canplaythrough', tryPlay, { once: true });
                // Also try playing on canplay as fallback
                audio.addEventListener('canplay', tryPlay, { once: true });
            }

            // Debug: log errors
            audio.addEventListener('error', (e) => {
                const mediaError = audio.error;
                console.error('[AudioPlayer] Audio error:', mediaError?.code, mediaError?.message, url);
            });

            this.currentAudio = audio;
            this.currentUrl = url;
            return audio;
        } catch (e) {
            console.error('[AudioPlayer] Fatal error:', e);
            return null;
        }
    }

    public setMuted(muted: boolean) {
        if (this.currentAudio) {
            this.currentAudio.muted = muted;
        }
    }

    public isPlaying(): boolean {
        return !!this.currentAudio && !this.currentAudio.paused;
    }

    public stop() {
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio.removeAttribute('src');
                this.currentAudio.load(); // Release media resources
            } catch (e) {}
            this.currentAudio = null;
            this.currentUrl = null;
        }
    }
}

export const audioPlayer = new AudioPlayerService();
