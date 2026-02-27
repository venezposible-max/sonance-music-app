
import React from 'react';
import { Play, Pause, Heart, Download, Zap, Trash2, Plus, Check, Loader2 } from 'lucide-react';

export default function SongList({ 
    list, currentSong, isPlaying, isLoading, playSong, isMobile, 
    offlineIdsSet, favoriteIdsSet, playlistIdsSet, downloadingIds,
    haptic, saveForOffline, deleteOffline, downloadSong, toggleFavorite,
    addToPlaylist, removeFromPlaylist, activeTab 
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {list.map((song, index) => {
                const isOffline = offlineIdsSet.has(song.id);
                const isDownloading = downloadingIds.has(song.id);
                const isFavorite = favoriteIdsSet.has(song.id);
                const inPlaylist = playlistIdsSet.has(song.id);
                const isActive = currentSong?.id === song.id;

                return (
                    <div key={`${song.id}-${index}`} className={`song-row ${isActive ? 'active' : ''}`} onClick={() => playSong(song, list)}>
                        {!isMobile && <div style={{ width: '40px', textAlign: 'center', opacity: 0.5, fontSize: '14px' }}>{index + 1}</div>}
                        <div style={{ position: 'relative' }}>
                            <img src={song.thumbnail} loading="lazy" decoding="async" style={{ width: '45px', height: '45px', borderRadius: '4px', objectFit: 'cover' }} />
                            {isActive && isPlaying && !isLoading && (
                                <div className="playing-gif">
                                    <span /> <span /> <span />
                                </div>
                            )}
                        </div>
                        <div style={{ flex: 1, marginLeft: isMobile ? '12px' : '15px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{
                                fontWeight: '700', fontSize: isMobile ? '14px' : '15px',
                                color: isActive ? 'var(--s-primary)' : '#fff', display: '-webkit-box',
                                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.2'
                            }}>
                                {song.title}
                            </div>
                            <div style={{ fontSize: isMobile ? '11px' : '13px', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                                {song.artist}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: isMobile ? '8px' : '20px', alignItems: 'center', marginLeft: '4px' }}>
                            {isDownloading ? (
                                <Loader2 size={16} className="spin" color="var(--s-primary)" />
                            ) : (
                                <Zap
                                    size={18}
                                    onClick={(e) => { e.stopPropagation(); haptic(); isOffline ? deleteOffline(song.id) : saveForOffline(song); }}
                                    className="icon-btn"
                                    color={isOffline ? "var(--s-primary)" : "#666"}
                                    fill={isOffline ? "var(--s-primary)" : "none"}
                                />
                            )}
                            <Download
                                size={18}
                                onClick={(e) => { e.stopPropagation(); haptic(); downloadSong(song); }}
                                className="icon-btn"
                                color="#666"
                            />
                            <Heart
                                size={18}
                                onClick={(e) => { e.stopPropagation(); haptic(); toggleFavorite(song); }}
                                fill={isFavorite ? "#fa233b" : "none"}
                                color={isFavorite ? "#fa233b" : "#666"}
                                className="icon-btn"
                            />
                            {activeTab === 'PLAYLISTS' ? (
                                <Trash2 size={18} color="#666" onClick={(e) => { e.stopPropagation(); haptic(); removeFromPlaylist(song.id); }} className="icon-btn" />
                            ) : (
                                inPlaylist ? (
                                    <Check size={20} color="#fa233b" onClick={(e) => { e.stopPropagation(); haptic(); removeFromPlaylist(song.id); }} style={{ cursor: 'pointer', strokeWidth: 3 }} />
                                ) : (
                                    <Plus size={20} color="#666" onClick={(e) => { e.stopPropagation(); haptic(); addToPlaylist(song); }} style={{ cursor: 'pointer' }} />
                                )
                            )}
                            <div style={{ width: isMobile ? '35px' : '60px', textAlign: 'right', fontSize: isMobile ? '10px' : '13px', opacity: 0.5 }}>
                                {Math.floor(song.duration / 60)}:{Math.floor(song.duration % 60).toString().padStart(2, '0')}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
