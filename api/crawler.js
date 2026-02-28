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

async function uploadToTelegram(buffer, title, artist, thumbnail) {
    try {
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'audio/mpeg' });
        formData.append('chat_id', TG_CHAT_ID);
        formData.append('audio', blob, `${title}.mp3`);
        formData.append('title', title);
        formData.append('performer', artist);

        if (thumbnail) {
            try {
                const thumbRes = await fetch(thumbnail);
                const thumbBlob = await thumbRes.blob();
                formData.append('thumbnail', thumbBlob, 'cover.jpg');
            } catch (e) {
                console.error("Error capturando carátula:", e.message);
            }
        }

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
    console.log("🚀 Iniciando Rastreador MODERADO (Top 100 Diario - Ahorro de Energía)...");

    while (true) {
        try {
            console.log("🔍 Escaneando Top 100 Global para cosechar éxitos recientes...");
            // Obtenemos el Chart Global (ID 0) con límite de 100
            const chartData = await axios.get(`https://api.deezer.com/chart/0/tracks?limit=100`);
            const tracks = chartData.data.data || [];

            let newsFound = 0;

            for (const trackInfo of tracks) {
                const songId = trackInfo.id;
                const title = trackInfo.title;
                const artist = trackInfo.artist.name;
                const thumbnail = trackInfo.album?.cover_big;

                if (processedSongs.has(songId)) continue;

                console.log(`🎵 Cosechando Éxito: ${title} - ${artist}`);

                try {
                    const detailed = await nativeDeezer.get(String(songId), "track");
                    if (!detailed || !detailed.info) continue;

                    const streamData = await nativeDeezer.getTrackStream(detailed.info);
                    if (!streamData) continue;

                    const chunks = [];
                    for await (const chunk of streamData.stream) {
                        chunks.push(chunk);
                    }
                    const fullBuffer = Buffer.concat(chunks);

                    const success = await uploadToTelegram(
                        fullBuffer,
                        title.replace(/[^a-zA-Z0-9- _]/g, ''),
                        artist,
                        thumbnail
                    );

                    if (success) {
                        console.log(`✅ Guardada: ${title}`);
                        processedSongs.add(songId);
                        newsFound++;
                    }

                    // Pausa de 10 segundos entre canciones (Super seguro)
                    await sleep(10000);

                } catch (err) {
                    console.error(`Error procesando: ${title}`, err.message);
                }
            }

            if (newsFound === 0) {
                console.log("✅ Todo el Top 100 ya está en tu nube.");
            }

            console.log("💤 Ciclo completado. Esperando 12 horas para ver si hay nuevos éxitos...");
            await sleep(43200000); // 12 horas de descanso para no gastar dinero innecesario

        } catch (err) {
            console.error("Error en ciclo de ahorro:", err.message);
            await sleep(3600000); // Reintentar en 1 hora si falla la red
        }
    }
}

startHarvesting();
