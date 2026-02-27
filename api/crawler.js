const Deezer = require('./deezer');
const axios = require('axios');

// --- CONFIGURACIÓN ---
const TG_BOT_TOKEN = '8694458454:AAFZADbbLvsai8AQAJtXcpKX_keQ_Ej8nsE';
const TG_CHAT_ID = '-1003398182364';
const DEEZER_ARL = "47a97466e43730927ed75073c52357bba961a7c16859d2aee6556393ad2cdfc385bfd627c4ce18e20dc4effaec64755b70587a6977a9aa8fa4c346336fd09b908d36b2ea25de64165d713d08a3a1027dc4c778f8d7d804dd25add664c7c1deea";

const nativeDeezer = new Deezer(DEEZER_ARL);
const processedSongs = new Set(); // Para esta sesión

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadToTelegram(buffer, title, artist) {
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
        return result.ok;
    } catch (e) {
        console.error(`Error subiendo ${title}:`, e.message);
        return false;
    }
}

async function startHarvesting() {
    console.log("🚀 Iniciando Rastreador Automático de Éxitos...");

    while (true) {
        try {
            // 1. Obtener éxitos globales de Deezer (Chart 0 es el global)
            console.log("🔍 Buscando novedades en los Charts mundiales...");
            const chartData = await axios.get('https://api.deezer.com/chart/0/tracks?limit=100');
            const tracks = chartData.data.data || [];

            for (const trackInfo of tracks) {
                const songId = trackInfo.id;
                const title = trackInfo.title;
                const artist = trackInfo.artist.name;

                if (processedSongs.has(songId)) continue;

                console.log(`🎵 Procesando: ${title} - ${artist}`);

                try {
                    // Obtener info detallada
                    const detailed = await nativeDeezer.get(songId, "track");
                    if (!detailed || !detailed.info) continue;

                    // Descargar stream
                    const streamData = await nativeDeezer.getTrackStream(detailed.info);
                    if (!streamData) continue;

                    // Convertir stream a buffer
                    const chunks = [];
                    for await (const chunk of streamData.stream) {
                        chunks.push(chunk);
                    }
                    const fullBuffer = Buffer.concat(chunks);

                    // Subir a Telegram
                    const success = await uploadToTelegram(fullBuffer, title.replace(/[^a-zA-Z0-9- _]/g, ''), artist);

                    if (success) {
                        console.log(`✅ [OK] Guardada en Telegram: ${title}`);
                        processedSongs.add(songId);
                    }

                    // Espera de 5 segundos para no saturar a Telegram ni a Deezer
                    await sleep(5000);

                } catch (songErr) {
                    console.error(`❌ Error con canción ${title}:`, songErr.message);
                }
            }

            console.log("💤 Ciclo completado. Esperando 1 hora para nuevas canciones...");
            await sleep(3600000); // Esperar 1 hora antes de volver a revisar los charts

        } catch (err) {
            console.error("💥 Error en el ciclo principal:", err.message);
            await sleep(60000); // Esperar 1 minuto si hay error de red
        }
    }
}

startHarvesting();
