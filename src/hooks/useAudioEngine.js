
import React, { useState, useEffect, useRef } from 'react';

// Elementos de audio globales (sobreviven a re-renders del componente)
const globalAudio = new Audio();
globalAudio.volume = 1.0;
globalAudio.preload = 'auto';
globalAudio.crossOrigin = 'anonymous';

export function useAudioEngine({ apiURL, haptic, getActiveList, offlineSongsRef }) {
    const [currentSong, _setCurrentSong] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, _setDuration] = useState(0);
    const [status, setStatus] = useState('Listo');
    const [volume, setVolume] = useState(100);

    const currentSongRef = useRef(null);
    const durationRef = useRef(0);
    const isPlayingIntentionRef = useRef(false);
    const playingListRef = useRef([]);
    const retryCountRef = useRef(0);
    const sessionBufferRef = useRef(null);
    const sessionBufferIdRef = useRef(null);
    const preparedNextUrlRef = useRef(null);
    const isLoadingRef = useRef(false);
    const nextSongRef = useRef(null);

    const setDuration = (val) => {
        durationRef.current = val;
        _setDuration(val);
    };

    const setCurrentSong = (val) => {
        currentSongRef.current = val;
        _setCurrentSong(val);
    };

    const cleanupSessionBuffer = () => {
        if (sessionBufferRef.current) {
            console.log("🧹 Liberando buffer de sesión previo para ahorrar RAM...");
            URL.revokeObjectURL(sessionBufferRef.current);
            sessionBufferRef.current = null;
            sessionBufferIdRef.current = null;
        }
    };

    const togglePlayRef = useRef(() => { });
    const nextTrackRef = useRef(() => { });
    const prevTrackRef = useRef(() => { });

    const playSong = async (song, overrideList = null, startTime = 0, forcedUrl = null) => {
        setIsLoading(true);
        setIsPlaying(true);
        setStatus(startTime > 0 ? 'Resumiendo...' : 'Cargando...');
        setCurrentSong(song);

        // Usar la duración del objeto song si existe como fallback inicial
        if (song.duration && isFinite(song.duration)) {
            setDuration(song.duration);
        } else {
            setDuration(0);
        }

        window.fmPreloadedId = null;
        isPlayingIntentionRef.current = true;

        if (startTime === 0) {
            retryCountRef.current = 0;
            preparedNextUrlRef.current = null;
            if (sessionBufferIdRef.current !== song.id) {
                cleanupSessionBuffer();
            }
        }

        if (overrideList && overrideList.length > 0) {
            playingListRef.current = overrideList;
        } else {
            playingListRef.current = getActiveList();
        }

        try {
            const offline = offlineSongsRef.current.find(s => s.id === song.id);
            if (offline && offline.blob) {
                globalAudio.src = URL.createObjectURL(offline.blob);
                if (startTime > 0) globalAudio.currentTime = startTime;
                await globalAudio.play().catch(e => {
                    console.warn('Local play error:', e);
                    setIsPlaying(false);
                });
                return;
            }

            const hasBuffer = sessionBufferIdRef.current === song.id && sessionBufferRef.current;

            if (hasBuffer && startTime > 0) {
                globalAudio.src = sessionBufferRef.current;
            } else if (forcedUrl) {
                globalAudio.src = forcedUrl;
            } else {
                const cacheBuster = startTime > 0 ? `&ts=${Date.now()}` : '';
                globalAudio.src = `${apiURL}/stream_final?id=${song.id}${song.searchQuery ? `&sq=${encodeURIComponent(song.searchQuery)}` : ''}${cacheBuster}`;
            }

            if (startTime > 0) {
                const onMetadata = () => {
                    globalAudio.currentTime = startTime;
                    globalAudio.removeEventListener('loadedmetadata', onMetadata);
                };
                globalAudio.addEventListener('loadedmetadata', onMetadata);
            }

            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = 'playing';
                navigator.mediaSession.metadata = new window.MediaMetadata({
                    title: song.title || 'Sonance Audio',
                    artist: song.artist || 'Desconocido',
                    album: song.album || 'Sonance App',
                    artwork: [
                        { src: song.thumbnail || 'https://sonance-eight.vercel.app/icon-512x512.png', sizes: '512x512', type: 'image/jpeg' }
                    ]
                });
            }

            let playPromise = globalAudio.play();
            if (playPromise !== undefined) {
                await playPromise.catch(e => {
                    if (e.name !== 'AbortError') throw e;
                });
            }
        } catch (err) {
            console.error("Audio Play Error:", err);
            setIsLoading(false);
            setIsPlaying(false);
        }
    };

    const getNextSong = () => {
        const list = playingListRef.current?.length > 0 ? playingListRef.current : getActiveList();
        const idx = list.findIndex(s => s.id === currentSongRef.current?.id);
        if (idx >= 0 && idx < list.length - 1) return list[idx + 1];
        return null;
    };

    const nextTrack = () => {
        const next = getNextSong();
        if (next) playSong(next, playingListRef.current);
    };

    const prevTrack = () => {
        const list = playingListRef.current?.length > 0 ? playingListRef.current : getActiveList();
        const idx = list.findIndex(s => s.id === currentSongRef.current?.id);
        if (idx > 0) playSong(list[idx - 1], list);
    };

    const togglePlay = () => {
        haptic();
        if (isPlaying) {
            isPlayingIntentionRef.current = false;
            setIsPlaying(false);
            setIsLoading(false);
            globalAudio.pause();
        } else {
            if (!currentSong) {
                const list = getActiveList();
                if (list && list.length > 0) playSong(list[0], list);
                return;
            }
            isPlayingIntentionRef.current = true;
            setIsPlaying(true);
            if (globalAudio.src && globalAudio.src !== '' && !globalAudio.src.endsWith('/')) {
                globalAudio.play().catch(() => playSong(currentSongRef.current, playingListRef.current));
            } else {
                playSong(currentSongRef.current, playingListRef.current);
            }
        }
    };

    useEffect(() => {
        togglePlayRef.current = togglePlay;
        nextTrackRef.current = nextTrack;
        prevTrackRef.current = prevTrack;
    });

    useEffect(() => {
        const updateProgress = () => {
            setProgress(globalAudio.currentTime);
            // Si la duración sigue en 0 pero el audio ya tiene duración, actualizar
            if (durationRef.current === 0 && globalAudio.duration > 0 && isFinite(globalAudio.duration)) {
                setDuration(globalAudio.duration);
            }
            if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
                if (globalAudio.duration > 0 && isFinite(globalAudio.duration)) {
                    navigator.mediaSession.setPositionState({
                        duration: globalAudio.duration,
                        playbackRate: globalAudio.playbackRate,
                        position: globalAudio.currentTime
                    }).catch(() => { });
                }
            }
            const currentDur = durationRef.current;
            if (currentDur > 0 && currentDur - globalAudio.currentTime < 20) {
                if (window.fmPreloadNext) window.fmPreloadNext();
            }
        };
        const updateDuration = () => {
            if (globalAudio.duration > 0 && isFinite(globalAudio.duration)) {
                setDuration(globalAudio.duration);
            }
        };
        const onPlaying = () => {
            setIsLoading(false);
            setIsPlaying(true);
            setStatus('Reproduciendo');
            retryCountRef.current = 0;
            updateDuration(); // Force update on play
        };
        const onPause = () => {
            if (isPlayingIntentionRef.current) {
                console.log("🔊 Interrupción detectada, intentando retomar en 1s...");
                setTimeout(() => {
                    if (isPlayingIntentionRef.current && globalAudio.paused) {
                        globalAudio.play().catch(() => { });
                    }
                }, 1000);
            } else {
                setIsPlaying(false);
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible' && isPlayingIntentionRef.current && globalAudio.paused) {
                globalAudio.play().catch(() => { });
            }
        };

        const onPlay = () => {
            setIsPlaying(true);
        };

        const onEnded = () => {
            if (isPlayingIntentionRef.current) {
                const next = getNextSong();
                if (next) playSong(next, playingListRef.current);
            }
        };

        const onError = () => {
            setIsLoading(false);
            if (!isPlayingIntentionRef.current) return;
            const failingSong = currentSongRef.current;
            if (failingSong && retryCountRef.current < 2) {
                retryCountRef.current++;
                const currentPos = globalAudio.currentTime;
                setTimeout(() => { if (isPlayingIntentionRef.current) playSong(failingSong, playingListRef.current, currentPos); }, 1500);
            } else {
                nextTrack();
            }
        };

        const onWaiting = () => {
            setIsLoading(true);
            setStatus('Buffering...');
        };

        globalAudio.addEventListener('timeupdate', updateProgress);
        globalAudio.addEventListener('loadedmetadata', updateDuration);
        globalAudio.addEventListener('durationchange', updateDuration);
        globalAudio.addEventListener('canplay', updateDuration);
        globalAudio.addEventListener('canplaythrough', updateDuration);
        globalAudio.addEventListener('playing', onPlaying);
        globalAudio.addEventListener('play', onPlay);
        globalAudio.addEventListener('pause', onPause);
        globalAudio.addEventListener('waiting', onWaiting);
        globalAudio.addEventListener('ended', onEnded);
        globalAudio.addEventListener('error', onError);
        document.addEventListener('visibilitychange', onVisibilityChange);

        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current());
                navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current());
                navigator.mediaSession.setActionHandler('previoustrack', () => prevTrackRef.current());
                navigator.mediaSession.setActionHandler('nexttrack', () => nextTrackRef.current());
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    const skipTime = details.seekTime || 0;
                    if (details.fastSeek && ('fastSeek' in globalAudio)) {
                        globalAudio.fastSeek(skipTime);
                    } else {
                        globalAudio.currentTime = skipTime;
                    }
                });
            } catch (e) {
                console.warn("Error assigning media controls", e);
            }
        }

        return () => {
            globalAudio.removeEventListener('timeupdate', updateProgress);
            globalAudio.removeEventListener('loadedmetadata', updateDuration);
            globalAudio.removeEventListener('durationchange', updateDuration);
            globalAudio.removeEventListener('canplay', updateDuration);
            globalAudio.removeEventListener('canplaythrough', updateDuration);
            globalAudio.removeEventListener('playing', onPlaying);
            globalAudio.removeEventListener('play', onPlay);
            globalAudio.removeEventListener('pause', onPause);
            globalAudio.removeEventListener('waiting', onWaiting);
            globalAudio.removeEventListener('ended', onEnded);
            globalAudio.removeEventListener('error', onError);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    // Sincronización de Volumen
    useEffect(() => {
        globalAudio.volume = volume / 100;
    }, [volume]);

    return {
        currentSong,
        isPlaying,
        isLoading,
        progress,
        duration,
        status,
        volume,
        setVolume,
        playSong,
        nextTrack,
        prevTrack,
        togglePlay,
        setProgress: (val) => { globalAudio.currentTime = val; setProgress(val); }
    };
}
