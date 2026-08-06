// Universal Web Audio Player with mobile-friendly DOM element unlock
class AudioPlayerService {
    private audioEl: HTMLAudioElement | null = null;
    private currentUrl: string | null = null;

    constructor() {
        if (typeof window !== 'undefined') {
            // Wait for DOM to be ready before creating element
            const initDOM = () => {
                let el = document.getElementById('knock-global-audio') as HTMLAudioElement;
                if (!el) {
                    el = document.createElement('audio');
                    el.id = 'knock-global-audio';
                    el.style.display = 'none';
                    // Important for mobile browsers
                    el.setAttribute('playsinline', 'true');
                    el.setAttribute('preload', 'auto');
                    // DO NOT use crossOrigin='anonymous' as it breaks iTunes / Apple CDN URLs
                    if (document.body) {
                        document.body.appendChild(el);
                    }
                }
                this.audioEl = el;

                // Silent unlock on first interaction
                const unlock = () => {
                    if (this.audioEl) {
                        const playPromise = this.audioEl.play();
                        if (playPromise !== undefined) {
                            playPromise.then(() => {
                                this.audioEl?.pause();
                            }).catch(() => {});
                        }
                    }
                    window.removeEventListener('click', unlock);
                    window.removeEventListener('touchstart', unlock);
                };
                window.addEventListener('click', unlock, { once: true, capture: true });
                window.addEventListener('touchstart', unlock, { once: true, capture: true });
            };

            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                initDOM();
            } else {
                document.addEventListener('DOMContentLoaded', initDOM);
            }
        }
    }

    private getAudioElement(): HTMLAudioElement | null {
        if (!this.audioEl) {
            let el = document.getElementById('knock-global-audio') as HTMLAudioElement;
            if (!el) {
                el = document.createElement('audio');
                el.id = 'knock-global-audio';
                el.style.display = 'none';
                el.setAttribute('playsinline', 'true');
                if (document.body) {
                    document.body.appendChild(el);
                }
            }
            this.audioEl = el;
        }
        return this.audioEl;
    }

    public play(url: string, loop: boolean = true): HTMLAudioElement | null {
        if (!url) return null;

        const audio = this.getAudioElement();
        if (!audio) return null;

        // Use a user-interaction-safe play approach
        const tryPlay = () => {
            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch((err) => {
                    // If autoplay is blocked, try again on next user tap
                    console.warn('[AudioPlayer] Autoplay blocked, retrying on tap:', err.message);
                    const retryPlay = () => {
                        audio.play().catch(() => {});
                        window.removeEventListener('click', retryPlay, { capture: true });
                        window.removeEventListener('touchstart', retryPlay, { capture: true });
                    };
                    window.addEventListener('click', retryPlay, { once: true, capture: true });
                    window.addEventListener('touchstart', retryPlay, { once: true, capture: true });
                });
            }
        };

        // If already loaded/loading the same track, don't restart the src
        if (this.currentUrl === url) {
            audio.loop = loop;
            if (audio.paused) {
                tryPlay();
            }
            return audio;
        }

        // Setup new track
        audio.src = url;
        audio.loop = loop;
        audio.volume = 1.0;

        // Try to play immediately, or when we have enough data
        if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            tryPlay();
        } else {
            // Using oncanplay to avoid stacking event listeners
            audio.oncanplay = () => {
                tryPlay();
                audio.oncanplay = null; // remove after firing
            };
            tryPlay(); // Still try immediately as fallback
        }

        // Debug: log errors
        audio.onerror = () => {
            const mediaError = audio.error;
            console.error('[AudioPlayer] Audio error:', mediaError?.code, mediaError?.message, url);
        };

        this.currentUrl = url;
        return audio;
    }

    public setMuted(muted: boolean) {
        const audio = this.getAudioElement();
        if (audio) {
            audio.muted = muted;
        }
    }

    public isPlaying(): boolean {
        return !!this.audioEl && !this.audioEl.paused;
    }

    public stop() {
        if (this.audioEl) {
            try {
                this.audioEl.pause();
                this.audioEl.removeAttribute('src');
                this.audioEl.load(); // Release media resources
            } catch (e) {}
            this.currentUrl = null;
        }
    }
}

export const audioPlayer = new AudioPlayerService();
