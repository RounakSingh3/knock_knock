// Universal Web Audio Player with browser autoplay unlock
class AudioPlayerService {
    private currentAudio: HTMLAudioElement | null = null;
    private currentUrl: string | null = null;
    private isUnlocked: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            const unlock = () => {
                this.isUnlocked = true;
                window.removeEventListener('click', unlock);
                window.removeEventListener('touchstart', unlock);
                window.removeEventListener('keydown', unlock);
            };
            window.addEventListener('click', unlock, { once: true });
            window.addEventListener('touchstart', unlock, { once: true });
            window.addEventListener('keydown', unlock, { once: true });
        }
    }

    public play(url: string, loop: boolean = true, muted: boolean = false): HTMLAudioElement | null {
        if (!url) return null;

        // If playing the same track, just update state
        if (this.currentAudio && this.currentUrl === url) {
            this.currentAudio.muted = muted;
            if (this.currentAudio.paused) {
                this.currentAudio.play().catch(() => {});
            }
            return this.currentAudio;
        }

        // Stop existing track
        this.stop();

        try {
            const audio = new Audio(url);
            audio.loop = loop;
            audio.muted = muted;
            audio.crossOrigin = 'anonymous';

            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch((err) => {
                    console.warn('Audio play attempt blocked by browser, waiting for user tap:', err);
                });
            }

            this.currentAudio = audio;
            this.currentUrl = url;
            return audio;
        } catch (e) {
            console.error('AudioPlayer play error:', e);
            return null;
        }
    }

    public setMuted(muted: boolean) {
        if (this.currentAudio) {
            this.currentAudio.muted = muted;
        }
    }

    public stop() {
        if (this.currentAudio) {
            try {
                this.currentAudio.pause();
                this.currentAudio.currentTime = 0;
                this.currentAudio.src = '';
            } catch (e) {}
            this.currentAudio = null;
            this.currentUrl = null;
        }
    }
}

export const audioPlayer = new AudioPlayerService();
