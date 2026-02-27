
import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Heart, Volume2 } from 'lucide-react';

export default function Player({
    currentSong, isPlaying, progress, duration, togglePlay,
    nextTrack, prevTrack, isMobile, haptic, favoriteIdsSet, toggleFavorite,
    volume, handleVolume, setProgress, status
}) {
    const isFavorite = currentSong ? favoriteIdsSet.has(currentSong.id) : false;

    const formatTime = (time) => {
        if (!isFinite(time) || isNaN(time)) return "0:00";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!currentSong) return null;

    return (
        <footer className="spotify-player" style={{
            height: '90px',
            padding: '0',
            bottom: isMobile ? 'calc(85px + var(--safe-area-inset-bottom))' : '0',
            flexDirection: 'column',
            margin: isMobile ? '0 12px' : '0',
            borderRadius: isMobile ? '16px' : '0',
            background: isMobile ? 'rgba(24, 24, 24, 0.98)' : '#0a0a0a',
            border: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
            boxShadow: isMobile ? '0 8px 32px rgba(0,0,0,0.5)' : 'none',
            gap: 0,
            zIndex: 1000
        }}>
            {isMobile ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ width: '100%', padding: '12px 16px 4px 16px', position: 'relative', zIndex: 20, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '10px', color: '#a0a0a0', fontVariantNumeric: 'tabular-nums', width: '32px', textAlign: 'right' }}>
                            {formatTime(progress)}
                        </span>
                        <div style={{ flex: 1, position: 'relative', height: '16px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (duration > 0 && isFinite(duration)) setProgress(((e.clientX - r.left) / r.width) * duration); }}
                        >
                            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', pointerEvents: 'none', position: 'absolute' }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, height: '100%',
                                    background: 'var(--s-primary)', width: `${Math.min(100, Math.max(0, (duration > 0 && isFinite(duration)) ? (progress / duration) * 100 : 0))}%`,
                                    boxShadow: '0 0 8px var(--s-primary)', borderRadius: '2px', transition: 'width 0.1s linear'
                                }} />
                                <div style={{
                                    position: 'absolute', top: '50%', left: `${Math.min(100, Math.max(0, (duration > 0 && isFinite(duration)) ? (progress / duration) * 100 : 0))}%`,
                                    transform: 'translate(-50%, -50%)', width: '10px', height: '10px',
                                    background: '#fff', borderRadius: '50%', pointerEvents: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                }} />
                            </div>
                            <input
                                type="range" min="0" max={isFinite(duration) ? Math.floor(duration) : 100} step="any" value={progress}
                                onChange={(e) => { if (duration > 0 && isFinite(duration)) setProgress(parseFloat(e.target.value)); }}
                                style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, opacity: 0, margin: 0, padding: 0, cursor: 'pointer', zIndex: 2 }}
                            />
                        </div>
                        <span style={{ fontSize: '10px', color: '#a0a0a0', fontVariantNumeric: 'tabular-nums', width: '32px', textAlign: 'left' }}>
                            {formatTime(duration)}
                        </span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', gap: '12px', position: 'relative', zIndex: 25 }}>
                        <img src={currentSong.thumbnail} style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong.title}</div>
                            <div style={{ fontSize: '12px', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong.artist}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <Heart
                                size={22}
                                onClick={(e) => { e.stopPropagation(); haptic(); toggleFavorite(currentSong); }}
                                fill={isFavorite ? '#fa233b' : 'none'}
                                color={isFavorite ? '#fa233b' : '#fff'}
                                style={{ opacity: isFavorite ? 1 : 0.6 }}
                            />
                            <SkipForward size={24} color="#fff" onClick={(e) => { e.stopPropagation(); haptic(); nextTrack(); }} />
                            <button
                                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                                style={{
                                    background: '#fff', border: 'none', borderRadius: '50%', width: '38px', height: '38px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                }}
                            >
                                {isPlaying ? <Pause size={20} fill="#000" color="#000" /> : <Play size={20} fill="#000" color="#000" style={{ transform: 'translateX(1px)' }} />}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '14px', height: '90px' }}>
                    <img src={currentSong.thumbnail} style={{ width: '56px', height: '56px', borderRadius: '4px', flexShrink: 0 }} />
                    <div style={{ width: '25%', overflow: 'hidden' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong.title}</div>
                        <div style={{ fontSize: '12px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSong.artist}</div>
                    </div>
                    <Heart size={18} onClick={() => { haptic(); toggleFavorite(currentSong); }}
                        fill={isFavorite ? '#fa233b' : 'none'}
                        color={isFavorite ? '#fa233b' : '#b3b3b3'}
                        style={{ cursor: 'pointer' }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '8px' }}>
                            <SkipBack size={20} className="player-icon" onClick={prevTrack} />
                            <div onClick={togglePlay} className="spotify-play-btn">
                                {isPlaying ? <Pause size={20} fill="black" /> : <Play size={20} fill="black" style={{ marginLeft: '2px' }} />}
                            </div>
                            <SkipForward size={20} className="player-icon" onClick={nextTrack} />
                        </div>
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="time-label">{formatTime(progress)}</span>
                            <div className="spotify-progress-bg" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (duration > 0 && isFinite(duration)) setProgress(((e.clientX - r.left) / r.width) * duration); }}>
                                <div className="spotify-progress-fill" style={{ width: `${(duration > 0 && isFinite(duration)) ? (progress / duration) * 100 : 0}%` }} />
                                <div className="spotify-progress-knob" style={{ left: `${(duration > 0 && isFinite(duration)) ? (progress / duration) * 100 : 0}%` }} />
                            </div>
                            <span className="time-label">{formatTime(duration)}</span>
                        </div>
                    </div>
                    <div style={{ width: '25%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                        <Volume2 size={20} color="#b3b3b3" />
                        <div className="spotify-volume-bg">
                            <input type="range" min="0" max="100" value={volume} onChange={(e) => handleVolume(e.target.value)} className="volume-slider" />
                        </div>
                    </div>
                </div>
            )}
        </footer>
    );
}
