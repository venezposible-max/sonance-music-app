
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Zap, ChevronLeft, X, Download, Smartphone } from 'lucide-react';
import './App.css';

// Hooks
import { useAudioEngine } from './hooks/useAudioEngine';

// Components
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import SongList from './components/SongList';
import Player from './components/Player';
import Logo from './components/Logo';

export default function App() {
    // --- ESTADOS DE DATOS ---
    const [query, setQuery] = useState('');
    const [songs, setSongs] = useState([]);
    const [activeTab, setActiveTab] = useState('EXPLORE');
    const [favorites, setFavorites] = useState(() => {
        try { return JSON.parse(localStorage.getItem('fm_favs') || '[]'); } catch (e) { return []; }
    });
    const [playlists, setPlaylists] = useState(() => {
        try { return JSON.parse(localStorage.getItem('fm_playlists') || '{"Mis Favoritas": []}'); } catch (e) { return { "Mis Favoritas": [] }; }
    });
    const [offlineSongs, setOfflineSongs] = useState([]);
    const [downloadingIds, setDownloadingIds] = useState(new Set());
    const [trendingAlbums, setTrendingAlbums] = useState([]);
    const [userName, setUserName] = useState(() => localStorage.getItem('fm_user_name') || 'Invitado');
    const [searchResults, setSearchResults] = useState({ songs: [], albums: [], playlists: [] });
    const [searchTab, setSearchTab] = useState('SONGS');
    const [viewingCollection, setViewingCollection] = useState(null);
    const [accentColor, setAccentColor] = useState('rgba(112, 0, 255, 0.3)');
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    // --- REFS ---
    const songsRef = useRef([]);
    const favoritesRef = useRef([]);
    const playlistsRef = useRef({});
    const viewingCollectionRef = useRef(null);
    const offlineSongsRef = useRef([]);

    // Actualizar refs síncronamente
    songsRef.current = songs;
    favoritesRef.current = favorites;
    playlistsRef.current = playlists;
    viewingCollectionRef.current = viewingCollection;
    offlineSongsRef.current = offlineSongs;

    // --- FASE 2: OPTIMIZACIÓN (HashMaps) ---
    const offlineIdsSet = useMemo(() => new Set(offlineSongs.map(s => s.id)), [offlineSongs]);
    const favoriteIdsSet = useMemo(() => new Set(favorites.map(f => f.id)), [favorites]);
    const playlistIdsSet = useMemo(() => new Set((playlists["Mis Favoritas"] || []).map(s => s.id)), [playlists]);

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const isWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)|wv/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || window.location.search.includes('mode=standalone') || !!window.Capacitor || isWebView;
    const [bannerDismissed, setBannerDismissed] = useState(() => localStorage.getItem('fm_dismiss_install') === 'true');

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiURL = (isLocal && !isStandalone) ? "http://localhost:4000/api" : "https://sonance-eight-puce.vercel.app/api";

    const haptic = (type = 'light') => {
        if (!navigator.vibrate) return;
        if (type === 'light') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(20);
        else if (type === 'error') navigator.vibrate([30, 50, 30]);
    };

    // --- MOTOR DE AUDIO (Hook Extractor) ---
    const getActiveList = () => {
        if (viewingCollectionRef.current?.songs?.length > 0) return viewingCollectionRef.current.songs;
        if (activeTab === 'FAVORITES') return favoritesRef.current;
        if (activeTab === 'PLAYLISTS') return playlistsRef.current["Mis Favoritas"] || [];
        return songsRef.current;
    };

    const {
        currentSong, isPlaying, isLoading, progress, duration, status,
        volume, setVolume, playSong, nextTrack, prevTrack, togglePlay, setProgress
    } = useAudioEngine({ apiURL, haptic, getActiveList, offlineSongsRef });

    // --- RESPONSIVE & PWA ---
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);


    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        // Capta el evento de instalación para Chrome/Android
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        });

        // Detecta si ya está instalado
        if (window.matchMedia('(display-mode: standalone)').matches) setShowInstallBtn(false);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // persistence
    useEffect(() => { localStorage.setItem('fm_favs', JSON.stringify(favorites)); }, [favorites]);
    useEffect(() => { localStorage.setItem('fm_playlists', JSON.stringify(playlists)); }, [playlists]);

    // --- FASE 5: ESTÉTICA ADAPTATIVA (Dynamic UI) ---
    useEffect(() => {
        if (currentSong?.thumbnail) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = currentSong.thumbnail;
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = 10;
                    canvas.height = 10;
                    ctx.drawImage(img, 0, 0, 10, 10);
                    const data = ctx.getImageData(0, 0, 10, 10).data;

                    let r = 0, g = 0, b = 0;
                    for (let i = 0; i < data.length; i += 4) {
                        r += data[i]; g += data[i + 1]; b += data[i + 2];
                    }
                    r = Math.floor(r / (data.length / 4));
                    g = Math.floor(g / (data.length / 4));
                    b = Math.floor(b / (data.length / 4));

                    // Asegurar que el color sea vibrante (mínima saturación)
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    if (brightness < 30) { r += 40; g += 40; b += 40; } // Aclarar si es muy oscuro

                    setAccentColor(`rgba(${r}, ${g}, ${b}, 0.5)`);
                    document.documentElement.style.setProperty('--accent-color', `rgb(${r}, ${g}, ${b})`);
                } catch (e) {
                    console.warn("CORS issue with thumbnail, using default color.");
                    setAccentColor('rgba(112, 0, 255, 0.3)');
                    document.documentElement.style.setProperty('--accent-color', '#00f2ff');
                }
            };
            img.onerror = () => {
                setAccentColor('rgba(112, 0, 255, 0.3)');
                document.documentElement.style.setProperty('--accent-color', '#00f2ff');
            };
        }
    }, [currentSong]);

    const installApp = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setShowInstallBtn(false);
        setDeferredPrompt(null);
    };

    const downloadAPK = () => {
        const a = document.createElement('a');
        a.href = '/sonance.apk';
        a.download = 'Sonance.apk';
        a.click();
        haptic();
    };

    // --- ACCIONES DE BÚSQUEDA ---
    const handleSearch = async (e, manualQuery) => {
        if (e) e.preventDefault();
        const searchTerm = manualQuery || query;
        if (!searchTerm) return;
        setActiveTab('EXPLORE');
        setViewingCollection(null);
        try {
            const res = await fetch(`${apiURL}/search?q=${encodeURIComponent(searchTerm)}`);
            const data = await res.json();
            setSearchResults({
                songs: (data.songs || []).filter(s => s.duration > 30),
                albums: data.albums || [],
                playlists: data.playlists || []
            });
            setSongs(data.songs || []);
        } catch (err) { console.error("Search error:", err); }
    };

    // --- BÚSQUEDA EN TIEMPO REAL (Fase 4: Live Search con Debounce) ---
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim().length >= 3) {
                handleSearch(null, query);
            } else if (query.trim().length === 0) {
                setSearchResults({ songs: [], albums: [], playlists: [] });
                setSongs([]);
            }
        }, 400); // 400ms es el estándar para que se sienta instantáneo pero seguro

        return () => clearTimeout(timer);
    }, [query]);

    const fetchCollection = async (item) => {
        try {
            const res = await fetch(`${apiURL}/collection?id=${item.id}&type=${item.type}`);
            const data = await res.json();
            setViewingCollection({ ...item, songs: data.songs || [] });
            setActiveTab('EXPLORE');
        } catch (e) { console.error("Collection error:", e); }
    };

    const clearSearch = () => {
        setQuery('');
        setSongs([]);
        setSearchResults({ songs: [], albums: [], playlists: [] });
        setViewingCollection(null);
    };

    const changeName = () => {
        const n = prompt("Tu nombre:", userName);
        if (n) { setUserName(n); localStorage.setItem('fm_user_name', n); }
    };

    // --- LÓGICA OFFLINE (IndexedDB) ---
    const DB_NAME = "FreeMusicDB";
    const STORE_NAME = "offline_tracks";
    const initDB = () => new Promise((resolve) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
        };
        req.onsuccess = (e) => resolve(e.target.result);
    });

    const loadOfflineList = async () => {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => setOfflineSongs(req.result || []);
    };

    const saveForOffline = async (song) => {
        setDownloadingIds(prev => new Set(prev).add(song.id));
        try {
            const res = await fetch(`${apiURL}/stream_final?id=${song.id}${song.searchQuery ? `&sq=${encodeURIComponent(song.searchQuery)}` : ''}&dl=1`);
            const blob = await res.blob();
            const db = await initDB();
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put({ ...song, blob });
            tx.oncomplete = () => {
                setDownloadingIds(prev => { const n = new Set(prev); n.delete(song.id); return n; });
                loadOfflineList();
            };
        } catch (e) { console.error("Offline save error:", e); }
    };

    const deleteOffline = async (id) => {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = loadOfflineList;
    };

    useEffect(() => {
        loadOfflineList();
        fetch(`${apiURL}/trending`)
            .then(r => r.json())
            .then(data => setTrendingAlbums(data.albums || []))
            .catch(err => {
                console.error("Trending fetch error:", err);
                setTrendingAlbums([]);
            });
    }, []);

    const toggleFavorite = (song) => {
        if (favoriteIdsSet.has(song.id)) setFavorites(favorites.filter(f => f.id !== song.id));
        else setFavorites([...favorites, song]);
    };

    const addToPlaylist = (song) => {
        if (!playlistIdsSet.has(song.id)) {
            setPlaylists({ ...playlists, "Mis Favoritas": [...(playlists["Mis Favoritas"] || []), song] });
        }
    };

    const removeFromPlaylist = (songId) => {
        setPlaylists({ ...playlists, "Mis Favoritas": playlists["Mis Favoritas"].filter(s => s.id !== songId) });
    };

    const downloadSong = async (song) => {
        try {
            setDownloadingIds(prev => new Set(prev).add(song.id));
            const titleSafe = encodeURIComponent(song.title || 'song');
            const sqSafe = encodeURIComponent((song.artist || '') + ' ' + (song.title || ''));
            const url = `${apiURL}/stream_final?id=${song.id}&sq=${sqSafe}&dl=1&title=${titleSafe}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error("Download failed");

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = `${(song.title || 'Sonance').replace(/[^a-zA-Z0-9- _]/g, '')}.mp3`;
            document.body.appendChild(a);
            a.click();

            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            }, 10000);
        } catch (err) {
            console.error(err);
        } finally {
            setDownloadingIds(prev => { const n = new Set(prev); n.delete(song.id); return n; });
        }
    };

    return (
        <div className="app-container" style={{ height: '100vh', width: '100vw', background: '#000', overflow: 'hidden', position: 'relative' }}>

            {/* CAPA DE FONDO DINÁMICA - BASE DE COLOR */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: accentColor.replace('0.5', '0.2'), // Color base muy tenue
                zIndex: 0,
                transition: 'background 3s ease'
            }} />

            {/* LUCES DINÁMICAS DIFUMINADAS */}
            <div className="dynamic-lights" style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 15% 25%, ${accentColor.replace('0.5', '0.6')}, transparent 45%), 
                             radial-gradient(circle at 85% 75%, ${accentColor.replace('0.5', '0.6')}, transparent 45%)`,
                filter: 'blur(60px)',
                zIndex: 1,
                transition: 'background 2s ease'
            }} />

            <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%', width: '100%' }}>
                {!isMobile && <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} playlists={playlists} />}

                <main style={{ flex: 1, overflowY: 'auto', background: 'transparent', position: 'relative', paddingBottom: isMobile ? '180px' : '100px' }}>

                    <SearchBar
                        query={query} setQuery={setQuery} handleSearch={handleSearch}
                        clearSearch={clearSearch} isMobile={isMobile} status={status}
                        isPlaying={isPlaying} changeName={changeName}
                    />

                    <div style={{ padding: isMobile ? '12px' : '32px' }}>
                        {activeTab === 'EXPLORE' && (
                            <>
                                {/* --- BANNER DE INSTALACIÓN OPTIMIZADO --- */}
                                {!isStandalone && !bannerDismissed && (window.innerWidth < 1024) && (
                                    <div style={{
                                        position: 'relative',
                                        margin: '0 0 24px 0',
                                        padding: '20px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        backdropFilter: 'blur(10px)'
                                    }}>
                                        <div
                                            onClick={() => { setBannerDismissed(true); localStorage.setItem('fm_dismiss_install', 'true'); }}
                                            style={{ position: 'absolute', top: '6px', right: '6px', padding: '4px', opacity: 0.5, cursor: 'pointer', zIndex: 10 }}
                                        >
                                            <X size={14} color="#fff" />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ width: '45px', height: '45px', background: 'var(--s-gradient)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Smartphone size={24} color="#fff" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                                                    {isIOS ? 'Sonance en tu iPhone' : isAndroid ? 'Instalar Sonance APK' : 'Sonance para Escritorio'}
                                                </div>
                                                <div style={{ fontSize: '12px', opacity: 0.6 }}>
                                                    {isIOS ? 'Usa Sonance como una app nativa' : 'Música sin límites en tu pantalla'}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={isIOS ? () => setShowIOSGuide(true) : isAndroid ? downloadAPK : installApp}
                                            style={{
                                                padding: '10px 20px',
                                                background: '#fff',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '50px',
                                                fontWeight: 'bold',
                                                fontSize: '13px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {isIOS ? '¿CÓMO?' : 'INSTALAR'}
                                        </button>
                                    </div>
                                )}

                                {/* --- MODAL GUÍA IOS --- */}
                                {showIOSGuide && (
                                    <div style={{
                                        position: 'fixed', inset: 0, zIndex: 1000,
                                        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '30px', textAlign: 'center'
                                    }}>
                                        <div style={{ width: '60px', height: '60px', background: 'var(--s-gradient)', borderRadius: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Smartphone size={32} color="#fff" />
                                        </div>
                                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Instalar en iPhone</h2>
                                        <p style={{ opacity: 0.8, marginBottom: '30px', lineHeight: '1.5' }}>
                                            1. Toca el botón <b>Compartir</b> de Safari (cuadrado con flecha hacia arriba).<br />
                                            2. Busca y selecciona <b>"Añadir a pantalla de inicio"</b>.
                                        </p>
                                        <button
                                            onClick={() => setShowIOSGuide(false)}
                                            style={{ padding: '12px 40px', background: '#fff', color: '#000', border: 'none', borderRadius: '50px', fontWeight: 'bold' }}
                                        >
                                            ENTENDIDO
                                        </button>
                                    </div>
                                )}

                                {searchResults.songs.length === 0 && !viewingCollection ? (
                                    <div className="home-hero" style={{ textAlign: 'center', marginTop: isMobile ? '30px' : '100px' }}>
                                        <div className="hero-logo-box" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
                                            <Logo size={240} isMobile={isMobile} />
                                        </div>
                                        <h2 style={{ fontSize: isMobile ? '36px' : '52px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-2px', background: 'linear-gradient(to right, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                            Sonance
                                        </h2>
                                        <p style={{ fontSize: isMobile ? '16px' : '18px', opacity: 0.5, maxWidth: '300px', margin: '0 auto', lineHeight: '1.5', fontWeight: '400', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                            High Fidelity Audio Experience
                                        </p>

                                        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                            {isAndroid && !isStandalone && (
                                                <button onClick={downloadAPK} style={{
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                                    color: '#fff', padding: '10px 20px', borderRadius: '50px', fontSize: '13px', fontWeight: 'bold',
                                                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                                                }}>
                                                    <Download size={16} color="var(--s-primary)" /> DESCARGAR APK
                                                </button>
                                            )}
                                        </div>

                                        {trendingAlbums.length > 0 && (
                                            <div style={{ marginTop: '40px' }}>
                                                <h3 style={{ textAlign: 'left', marginBottom: '16px' }}>Tendencias</h3>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {trendingAlbums.map(album => (
                                                        <div key={album.id} onClick={() => fetchCollection(album)} className="song-row trending-item">
                                                            <img src={album.thumbnail} style={{ width: '56px', height: '56px', borderRadius: '8px' }} alt="" />
                                                            <div style={{ flex: 1, textAlign: 'left' }}>
                                                                <div style={{ fontWeight: 'bold' }}>{album.title}</div>
                                                                <div style={{ fontSize: '12px', opacity: 0.6 }}>{album.artist}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : viewingCollection ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', cursor: 'pointer' }} onClick={() => setViewingCollection(null)}>
                                            <ChevronLeft size={24} /> <span>Volver</span>
                                        </div>
                                        <h1 style={{ marginBottom: '20px' }}>{viewingCollection.title}</h1>
                                        <SongList
                                            list={viewingCollection.songs}
                                            {...{ currentSong, isPlaying, isLoading, playSong, isMobile, offlineIdsSet, favoriteIdsSet, playlistIdsSet, downloadingIds, haptic, saveForOffline, deleteOffline, downloadSong, toggleFavorite, addToPlaylist, removeFromPlaylist, activeTab }}
                                        />
                                    </>
                                ) : (
                                    <>
                                        {/* --- SELECTOR DE TABS DE BÚSQUEDA --- */}
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '8px' }}>
                                            {['SONGS', 'ALBUMS', 'PLAYLISTS'].map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => setSearchTab(tab)}
                                                    style={{
                                                        padding: '8px 20px',
                                                        borderRadius: '50px',
                                                        background: searchTab === tab ? 'var(--s-primary)' : 'rgba(255,255,255,0.05)',
                                                        color: searchTab === tab ? '#000' : '#fff',
                                                        border: 'none',
                                                        fontWeight: 'bold',
                                                        fontSize: '13px',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    {tab === 'SONGS' ? 'Canciones' : tab === 'ALBUMS' ? 'Álbumes' : 'Playlists'}
                                                </button>
                                            ))}
                                        </div>

                                        {searchTab === 'SONGS' && (
                                            <SongList
                                                list={searchResults.songs}
                                                {...{ currentSong, isPlaying, isLoading, playSong, isMobile, offlineIdsSet, favoriteIdsSet, playlistIdsSet, downloadingIds, haptic, saveForOffline, deleteOffline, downloadSong, toggleFavorite, addToPlaylist, removeFromPlaylist, activeTab }}
                                            />
                                        )}

                                        {searchTab === 'ALBUMS' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                                                {searchResults.albums.map(album => (
                                                    <div key={album.id} onClick={() => fetchCollection(album)} style={{ cursor: 'pointer' }} className="album-card">
                                                        <img src={album.thumbnail} style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px', marginBottom: '8px' }} alt="" />
                                                        <div style={{ fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.title}</div>
                                                        <div style={{ fontSize: '12px', opacity: 0.6 }}>{album.artist}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {searchTab === 'PLAYLISTS' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {searchResults.playlists.map(pl => (
                                                    <div key={pl.id} onClick={() => fetchCollection(pl)} className="song-row" style={{ cursor: 'pointer' }}>
                                                        <img src={pl.thumbnail} style={{ width: '56px', height: '56px', borderRadius: '8px' }} alt="" />
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 'bold' }}>{pl.title}</div>
                                                            <div style={{ fontSize: '12px', opacity: 0.6 }}>Playlist • {pl.artist}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {activeTab === 'FAVORITES' && (
                            <>
                                <h1>Tus me gusta</h1>
                                <SongList list={favorites} {...{ currentSong, isPlaying, isLoading, playSong, isMobile, offlineIdsSet, favoriteIdsSet, playlistIdsSet, downloadingIds, haptic, saveForOffline, deleteOffline, downloadSong, toggleFavorite, addToPlaylist, removeFromPlaylist, activeTab }} />
                            </>
                        )}

                        {activeTab === 'PLAYLISTS' && (
                            <>
                                <h1>Biblioteca</h1>
                                <SongList list={playlists["Mis Favoritas"]} {...{ currentSong, isPlaying, isLoading, playSong, isMobile, offlineIdsSet, favoriteIdsSet, playlistIdsSet, downloadingIds, haptic, saveForOffline, deleteOffline, downloadSong, toggleFavorite, addToPlaylist, removeFromPlaylist, activeTab }} />
                            </>
                        )}
                    </div>
                </main>

                <Player
                    {...{ currentSong, isPlaying, progress, duration, togglePlay, nextTrack, prevTrack, isMobile, haptic, favoriteIdsSet, toggleFavorite, volume, handleVolume: setVolume, setProgress, status }}
                />

                {/* NAV MÓVIL */}
                {isMobile && (
                    <nav className="mobile-nav">
                        <div onClick={() => setActiveTab('EXPLORE')} style={{ color: activeTab === 'EXPLORE' ? '#00f2ff' : '#666' }}>Inicio</div>
                        <div onClick={() => setActiveTab('PLAYLISTS')} style={{ color: activeTab === 'PLAYLISTS' ? '#00f2ff' : '#666' }}>Biblioteca</div>
                        <div onClick={() => setActiveTab('FAVORITES')} style={{ color: activeTab === 'FAVORITES' ? '#00f2ff' : '#666' }}>Favoritos</div>
                    </nav>
                )}
            </div>
        </div>
    );
}
