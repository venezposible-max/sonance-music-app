const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const yts = require('yt-search');
const scdl = require('soundcloud-downloader').default;
const playdl = require('play-dl');
const Deezer = require('./deezer');

// --- ARLs de Deezer (rotación automática si uno falla) ---
const DEEZER_ARLS = [
    "47a97466e43730927ed75073c52357bba961a7c16859d2aee6556393ad2cdfc385bfd627c4ce18e20dc4effaec64755b70587a6977a9aa8fa4c346336fd09b908d36b2ea25de64165d713d08a3a1027dc4c778f8d7d804dd25add664c7c1deea",
    "8c670e5429397b6f18b14254fc0b0541dd52389921003e5e3b72d47aae8d92ff12518be1061c714f2a364c6a676763b44660390cea6a1dc007cb6090f167a7da44cce0db998b37e4a7087100b9256868b3b932d466ee1812c66a8c9ab1574244"
];
let currentArlIndex = 0;
const getDeezer = () => new Deezer(DEEZER_ARLS[currentArlIndex]);
const switchArl = () => {
    currentArlIndex = (currentArlIndex + 1) % DEEZER_ARLS.length;
    console.log(`🔄 ARL rotado al índice ${currentArlIndex}`);
};
let nativeDeezer = getDeezer();


const app = express();
const PORT = 4000;

// --- CONFIGURACIÓN TELEGRAM (Cosechador Automático) ---
const TG_BOT_TOKEN = '8694458454:AAFZADbbLvsai8AQAJtXcpKX_keQ_Ej8nsE';
const TG_CHAT_ID = '-1003398182364';
const harvestedSongs = new Set(); // Evita subir la misma canción en la misma sesión

async function uploadToTelegram(buffer, title, artist) {
    if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
    try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'audio/mpeg' });
        formData.append('chat_id', TG_CHAT_ID);
        formData.append('audio', blob, `${title}.mp3`);
        formData.append('title', title);
        formData.append('performer', artist);

        const response = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendAudio`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (result.ok) {
            console.log(`✅ [Telegram] "${title}" subida con éxito.`);
        } else {
            console.error(`❌ [Telegram] Error API Telegram:`, result.description);
        }
    } catch (e) {
        console.error(`❌ [Telegram] Error de red:`, e.message);
    }
}

// Caché en memoria para Vercel Serverless (persiste entre invocaciones en caliente)
const SEARCH_CACHE = new Map();
const SEARCH_TTL = 30 * 60 * 1000; // 30 min
const MAX_SEARCH_ENTRIES = 200;

function cacheGet(map, key, ttl) {
    const entry = map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > ttl) { map.delete(key); return null; }
    return entry.data;
}

function cacheSet(map, key, data, max) {
    if (map.size >= max) {
        const firstKey = map.keys().next().value;
        map.delete(firstKey);
    }
    map.set(key, { data, ts: Date.now() });
}

app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.url}`);
    next();
});

app.use(cors({ origin: '*' }));
app.use(express.json());

// No usamos static ni catch-all aquí porque Vercel lo maneja mejor desde vercel.json
// y evita errores de rutas de archivos inexistentes en el container.


app.get(['/api/test', '/test'], (req, res) => res.send('EXPRESS_OK'));
app.get(['/api/debug_path', '/debug_path'], (req, res) => {
    res.json({ url: req.url, originalUrl: req.originalUrl, params: req.params, query: req.query });
});

app.get(['/api/trending', '/trending'], async (req, res) => {
    try {
        const keywords = [
            "Top Hits 2024",
            "Lanzamientos",
            "Éxitos Hoy",
            "Billboard Hot 100",
            "Global Trends",
            "Lo más escuchado",
            "Novedades 2024"
        ];
        // Seleccionamos una palabra basada en el día actual (rotación diaria)
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        const selectedKeyword = keywords[dayOfYear % keywords.length];

        console.log(`Fetching trending for: ${selectedKeyword}`);
        const albums = await nativeDeezer.search(selectedKeyword, "album");
        const top4 = (albums || []).slice(0, 4).map(a => ({
            id: a.ALB_ID,
            title: a.ALB_TITLE,
            artist: a.ART_NAME,
            thumbnail: `https://e-cdns-images.dzcdn.net/images/cover/${a.ALB_PICTURE}/500x500-000000-80-0-0.jpg`,
            type: 'album'
        }));
        res.json({ albums: top4, topic: selectedKeyword });
    } catch (err) {
        console.error("Trending Error:", err.message);
        // Fallback: Si Deezer nativo falla, enviar una respuesta vacía o estática en lugar de 500
        res.json({ albums: [], topic: "Sonance" });
    }
});

app.get(['/api/search', '/search'], async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json({ success: true, songs: [], albums: [], playlists: [] });

    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = cacheGet(SEARCH_CACHE, cacheKey, SEARCH_TTL);
    if (cached) {
        console.log(`⚡ [CACHE HIT] Búsqueda: ${query}`);
        return res.json({ success: true, ...cached });
    }

    try {
        console.log(`🔍 Búsqueda Multi-Fuente: ${query}`);

        // 1. Buscamos Canciones (con metadatos para motor de audio)
        const trackRes = await axios.get(`https://api.deezer.com/search/track?q=${encodeURIComponent(query)}&limit=15`);
        // 2. Buscamos Álbumes
        const albumRes = await axios.get(`https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=6`);
        // 3. Buscamos Playlists
        const playlistRes = await axios.get(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(query)}&limit=6`);

        const songs = (trackRes.data.data || []).map(item => ({
            id: `dz-${item.id}`,
            searchQuery: `${item.artist.name} ${item.title}`,
            title: item.title,
            artist: item.artist.name,
            album: item.album.title,
            thumbnail: item.album.cover_medium || item.album.cover_big || item.album.cover_xl, // Optimizado size
            duration: item.duration
        }));

        const albums = (albumRes.data.data || []).map(item => ({
            id: item.id,
            title: item.title,
            artist: item.artist.name,
            thumbnail: item.cover_medium || item.cover_big || item.cover_xl, // Optimizado size
            type: 'album'
        }));

        const playlists = (playlistRes.data.data || []).map(item => ({
            id: item.id,
            title: item.title,
            artist: `Por ${item.user.name}`,
            thumbnail: item.picture_medium || item.picture_big || item.picture_xl, // Optimizado size
            type: 'playlist',
            tracklist: item.tracklist
        }));

        const result = {
            songs: songs, // ⚡ Sin verificación SC/YT (Lazy verification)
            albums: albums,
            playlists: playlists
        };

        cacheSet(SEARCH_CACHE, cacheKey, result, MAX_SEARCH_ENTRIES);

        res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("Search API Error:", err.message);
        res.json({ success: false, songs: [], albums: [], playlists: [] });
    }
});

// Endpoint para obtener canciones de un álbum o playlist
app.get(['/api/collection', '/collection'], async (req, res) => {
    const { id, type } = req.query;
    if (!id || !type) return res.status(400).json({ success: false });

    const cacheKey = `col_${type}_${id}`;
    const cached = cacheGet(SEARCH_CACHE, cacheKey, SEARCH_TTL);
    if (cached) return res.json({ success: true, songs: cached });

    try {
        let url = `https://api.deezer.com/${type}/${id}/tracks`;
        const resp = await axios.get(url);
        const songs = (resp.data.data || []).map(item => ({
            id: `dz-${item.id}`,
            searchQuery: `${item.artist.name} ${item.title}`,
            title: item.title,
            artist: item.artist.name,
            album: item.album ? item.album.title : '',
            thumbnail: item.album ? (item.album.cover_medium || item.album.cover_xl) : '',
            duration: item.duration
        }));

        cacheSet(SEARCH_CACHE, cacheKey, songs, MAX_SEARCH_ENTRIES);
        res.json({ success: true, songs });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.get(['/api/stream_final', '/api/stream_final/:any', '/stream_final', '/stream_final/:any'], async (req, res) => {
    let id = req.query.id;
    let sq = req.query.sq;

    // Extraer ID del path siempre que no venga por query
    if (!id) {
        // req.params.any captura lo que está después de stream_final en la ruta
        const pathSuffix = req.params.any || "";
        // Limpiamos la ruta para obtener solo el ID
        const cleanPath = pathSuffix.replace(/^\//, '').split('?')[0];
        const lastPart = cleanPath.split('/').pop() || "";

        if (lastPart.endsWith('.mp3')) {
            id = lastPart.replace('.mp3', '');
        } else if (lastPart && /^\d+$/.test(lastPart)) {
            id = lastPart;
        }
    }

    if (!id && !sq) return res.status(404).send("Not Found");

    const withTimeout = (promise, ms) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
            promise.then(r => { clearTimeout(timer); resolve(r); }).catch(err => { clearTimeout(timer); reject(err); });
        });
    };

    const getDeezerStream = async (queryOrId, isId = false) => {
        for (let attempt = 0; attempt < DEEZER_ARLS.length; attempt++) {
            try {
                let track;
                if (isId) {
                    const data = await nativeDeezer.get(queryOrId, "track");
                    track = data?.info;
                } else {
                    const dzTracks = await nativeDeezer.search(queryOrId, "track", 20);
                    track = dzTracks?.find(t => Number(t.DURATION) > 40) || dzTracks?.[0];
                }

                if (track) {
                    const streamData = await nativeDeezer.getTrackStream(track);
                    if (streamData) return { provider: 'Deezer Direct', stream: streamData.stream, size: streamData.size };
                }
            } catch (dzErr) {
                console.log(`Deezer Error (${isId ? 'ID' : 'SQ'}): ${dzErr.message}`);
                switchArl();
                nativeDeezer = getDeezer();
            }
        }
        throw new Error('Deezer failed');
    };

    const getYTStream = async (query) => {
        const ytResults = await yts(query);
        const video = ytResults.videos ? ytResults.videos[0] : null;
        if (video && video.seconds > 45) {
            const streamInfo = await playdl.stream(video.url);
            return { provider: 'YouTube', stream: streamInfo.stream };
        }
        throw new Error('YT failed');
    };

    try {
        let streamData = null;

        // Prioridad 1: Si hay ID, ir directo a Deezer ID
        if (id) {
            try {
                streamData = await withTimeout(getDeezerStream(id, true), 8000);
            } catch (e) { console.log("Deezer ID falló, probando con SQ..."); }
        }

        // Prioridad 2: Si no hubo stream por ID, probar por SQ (Deezer -> YT)
        if (!streamData && sq) {
            try {
                streamData = await withTimeout(getDeezerStream(sq, false), 10000);
            } catch (e) {
                try {
                    streamData = await getYTStream(sq);
                } catch (e2) {
                    return res.status(404).end();
                }
            }
        }

        if (!streamData) return res.status(404).end();

        const { provider, stream, size } = streamData;
        console.log(`🚀 [${provider}] Stream Start: ${sq || id} (${size || 'unknown'} bytes)`);

        res.setHeader('Content-Type', 'audio/mpeg');

        // ASYNC BUFFERING EN TIEMPO REAL:
        // Evitamos el backpressure del "pipe()" (que era lo que mataba la conexión a los 10 segundos). 
        // Empezamos a enviarle la canción al celular en el MILISEGUNDO 1 para garantizar arranque rápido,
        // pero obligamos a descargar la canción desde Deezer violéntamente en segundo plano.

        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, stale-while-revalidate');

        if (req.query.dl) {
            const safeTitle = (req.query.title || sq || id || 'song').replace(/[^a-zA-Z0-9- _]/g, '');
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
            res.setHeader('Content-Type', 'application/octet-stream'); // Force download on stubborn browsers
        }

        const range = req.headers.range;
        if (range && size) {
            if (range === 'bytes=0-') {
                res.status(206);
                res.setHeader('Content-Range', `bytes 0-${size - 1}/${size}`);
                res.setHeader('Content-Length', size);
            } else {
                res.status(200);
                res.setHeader('Content-Length', size);
            }
        } else {
            if (size) res.setHeader('Content-Length', size);
            res.status(200);
        }

        // Descarga violenta sin restricción de memoria RAM ni backpressure:
        const chunks = [];
        stream.on('data', (chunk) => {
            res.write(chunk);
            chunks.push(chunk);
        });

        stream.on('end', () => {
            res.end();
            // Cosecha automática a Telegram en segundo plano
            const songId = id || sq || 'unknown';
            if (songId !== 'unknown' && !harvestedSongs.has(songId)) {
                harvestedSongs.add(songId);
                const fullBuffer = Buffer.concat(chunks);
                const title = (req.query.title || sq || id || 'Sonance').replace(/[^a-zA-Z0-9- _]/g, '');
                const artist = sq ? sq.split(' - ')[0] : 'Sonance';
                uploadToTelegram(fullBuffer, title, artist);
            }
        });

        stream.on('error', (err) => {
            console.error("Stream Error Real-time:", err.message);
            if (!res.writableEnded) res.end();
        });

        res.on('close', () => { if (stream && stream.destroy) stream.destroy(); });

    } catch (err) {
        console.error("Global Error:", err.message);
        res.end();
    }
});

// --- FASE 6: INTEGRACIÓN CON ALEXA ---
app.post(['/api/alexa', '/alexa'], async (req, res) => {
    const { request, session } = req.body;
    if (!request) return res.status(400).end();

    const type = request.type;
    const locale = request.locale || 'es-ES';
    console.log(`🎙️ Alexa Request: ${type} [${locale}]`);

    // URL base dinámica (Crucial para que Alexa encuentre el stream en cualquier despliegue)
    const baseUrl = `https://${req.headers.host}`;

    // 1. Bienvenida (Launch)
    if (type === 'LaunchRequest') {
        const text = locale.startsWith('es') ? 'Bienvenido a Sonance. ¿Qué canción quieres escuchar?' : 'Welcome to Sonance. What song would you like to hear?';
        return res.json({
            version: '1.0',
            response: {
                outputSpeech: { type: 'PlainText', text },
                shouldEndSession: false
            }
        });
    }

    // 2. Comandos de Voz (Intents)
    if (type === 'IntentRequest') {
        const intentName = request.intent.name;
        console.log(`🎯 Alexa Intent: ${intentName}`);

        // Búsqueda y Reproducción
        const musicIntents = ['PlayMusicIntent', 'GetNewSongIntent', 'AMAZON.SearchAction<object@MusicCreativeWork>', 'SearchAndPlayIntent'];
        if (musicIntents.includes(intentName)) {
            const slots = request.intent.slots || {};
            // Extraer query de cualquier slot posible que Alexa envíe
            const querySlot = slots.query?.value || slots.MusicTitle?.value || slots.MusicArtist?.value ||
                slots.object?.value || slots.Artist?.value || slots.Song?.value ||
                slots.Keywords?.value || "";

            if (!querySlot) {
                const askText = locale.startsWith('es') ? '¿Qué música quieres escuchar?' : 'What music would you like to listen to?';
                return res.json({ version: '1.0', response: { outputSpeech: { type: 'PlainText', text: askText }, shouldEndSession: false } });
            }

            try {
                console.log(`🔍 Alexa buscando: ${querySlot}`);
                // Buscamos con un timeout estricto para no colgar a Alexa
                const trackRes = await axios.get(`https://api.deezer.com/search/track?q=${encodeURIComponent(querySlot)}&limit=1`, { timeout: 3500 });
                const track = trackRes.data.data?.[0];

                if (track) {
                    const artistName = track.artist?.name || "Artista";
                    const trackTitle = track.title || "Canción";

                    // Truco para Alexa: La URL termina en .mp3 para que su motor lo acepte sin dudas
                    const streamUrl = `${baseUrl}/api/stream_final/${track.id}.mp3?sq=${encodeURIComponent(artistName + " " + trackTitle)}`;

                    // Token para identificar el stream y permitir Enqueue después
                    const safeQ = querySlot.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) || "music";
                    const mainToken = `s_${safeQ}_${Date.now()}`;

                    const message = locale.startsWith('es') ? `Reproduciendo ${trackTitle} de ${artistName}.` : `Playing ${trackTitle} by ${artistName}.`;

                    return res.json({
                        version: '1.0',
                        response: {
                            outputSpeech: { type: 'PlainText', text: message },
                            directives: [{
                                type: 'AudioPlayer.Play',
                                playBehavior: 'REPLACE_ALL',
                                audioItem: {
                                    stream: { url: streamUrl, token: mainToken, offsetInMilliseconds: 0 },
                                    metadata: {
                                        title: trackTitle,
                                        subtitle: artistName,
                                        art: { sources: [{ url: track.album?.cover_big || "" }] }
                                    }
                                }
                            }],
                            shouldEndSession: true
                        }
                    });
                }
            } catch (err) {
                console.error("Alexa Search Error:", err.message);
            }
            const failText = locale.startsWith('es') ? 'Lo siento, no pude localizar esa canción.' : 'Sorry, I couldn\'t find that song.';
            return res.json({ version: '1.0', response: { outputSpeech: { type: 'PlainText', text: failText }, shouldEndSession: true } });
        }

        // Control de Reproducción
        if (intentName === 'AMAZON.PauseIntent' || intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
            return res.json({ version: '1.0', response: { directives: [{ type: 'AudioPlayer.Stop' }], shouldEndSession: true } });
        }

        if (intentName === 'AMAZON.ResumeIntent') {
            // Nota: El Resume es complejo sin base de datos, pero intentamos retomar lo último si Alexa lo permite
            return res.json({
                version: '1.0',
                response: {
                    outputSpeech: { type: 'PlainText', text: 'Continuando.' },
                    shouldEndSession: true
                }
            });
        }

        if (intentName === 'AMAZON.HelpIntent') {
            const helpText = locale.startsWith('es') ? 'Dime el nombre de una canción o artista que quieras escuchar.' : 'Tell me the name of a song or artist you want to hear.';
            return res.json({ version: '1.0', response: { outputSpeech: { type: 'PlainText', text: helpText }, shouldEndSession: false } });
        }
    }

    // --- CONTINUIDAD (Radio Infinita) ---
    if (type === 'AudioPlayer.PlaybackNearlyFinished') {
        const token = request.token || "";
        if (token.startsWith('s_')) {
            const parts = token.split('_');
            const qStr = parts[1];

            try {
                const trackRes = await axios.get(`https://api.deezer.com/search/track?q=${encodeURIComponent(qStr)}&limit=20`);
                const tracks = trackRes.data.data;
                const nextT = tracks[Math.floor(Math.random() * tracks.length)];

                if (nextT) {
                    const nextUrl = `${baseUrl}/api/stream_final/${nextT.id}.mp3?sq=${encodeURIComponent(nextT.artist.name + " " + nextT.title)}`;
                    const nextTok = `s_${qStr}_${Date.now()}`;
                    return res.json({
                        version: '1.0',
                        response: {
                            directives: [{
                                type: 'AudioPlayer.Play',
                                playBehavior: 'ENQUEUE',
                                audioItem: {
                                    stream: { url: nextUrl, token: nextTok, expectedPreviousToken: token, offsetInMilliseconds: 0 }
                                }
                            }]
                        }
                    });
                }
            } catch (e) { console.error("Buffer Error Alexa:", e.message); }
        }
    }

    // Respuesta silenciosa para eventos genéricos de AudioPlayer
    if (type.startsWith('AudioPlayer.')) return res.json({ version: '1.0', response: {} });

    // Respuesta por defecto
    res.json({ version: '1.0', response: { shouldEndSession: true } });
});

// --- RUTEOS DEL FRONTEND (Para Railway u otros servidores completos) ---
// En Vercel esto se ignora porque vercel.json maneja el enrutamiento.
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT_SERVER = process.env.PORT || PORT;
if (process.env.RAILWAY_ENVIRONMENT || process.env.PORT || require.main === module) {
    app.listen(PORT_SERVER, () => console.log(`🚀 Servidor listo en el puerto ${PORT_SERVER}`));
}

module.exports = app;
