const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const convertBtn = document.getElementById("convert-btn");
const downloadZipBtn = document.getElementById("download-zip-btn");
const chartArea = document.getElementById("chart-area");
const metaArea = document.getElementById("meta-area");

// Elementos de la UI interactiva de metadatos
const albumToggle = document.getElementById("album-toggle");
const albumInput = document.getElementById("album-input");
const stickerToggle = document.getElementById("sticker-toggle");
const stickerInput = document.getElementById("sticker-input");

let selectedFiles = [];
let currentSongKey = "pack";

// Activar/Desactivar inputs basados en los switches
albumToggle.addEventListener("change", (e) => {
    albumInput.disabled = !e.target.checked;
    if(e.target.checked) albumInput.focus();
});

stickerToggle.addEventListener("change", (e) => {
    stickerInput.disabled = !e.target.checked;
    if(e.target.checked) stickerInput.focus();
});

dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", e => handleFiles(e.target.files));
dropZone.addEventListener("dragover", e => { 
    e.preventDefault(); 
    dropZone.style.borderColor = "#ff007f"; 
});
dropZone.addEventListener("drop", e => { 
    e.preventDefault(); 
    handleFiles(e.dataTransfer.files); 
});

function handleFiles(files) {
    selectedFiles = Array.from(files).filter(f => f.name.endsWith('.json'));
    if (selectedFiles.length > 0) {
        document.getElementById("file-list").innerText = `🔥 ¡${selectedFiles.length} mapa(s) detectado(s) listo(s) para reventar!`;
        convertBtn.style.display = "block";
        downloadZipBtn.style.display = "none";
    }
}

function getDiff(name) {
    const n = name.toLowerCase();
    if (n.includes("-easy")) return "easy";
    if (n.includes("-hard")) return "hard";
    return "normal";
}

function copyToClipboard(areaId, button) {
    const textarea = document.getElementById(areaId);
    if (!textarea.value) {
        button.innerText = "❌ ¡Vacío!";
        setTimeout(() => button.innerText = "📋 Copiar", 1500);
        return;
    }
    
    navigator.clipboard.writeText(textarea.value).then(() => {
        button.innerText = "✅ ¡Copiado!";
        button.style.borderColor = "#00ff66";
        button.style.color = "#00ff66";
        
        setTimeout(() => {
            button.innerText = "📋 Copiar";
            button.style.borderColor = "";
            button.style.color = "";
        }, 2000);
    }).catch(err => {
        console.error("Error al copiar código: ", err);
    });
}

convertBtn.addEventListener("click", async () => {
    const finalChart = { 
        version: "2.0.0", 
        scrollSpeed: {}, 
        notes: {}, 
        events: [], 
        generatedBy: "Chart Convert. V2 GCD" 
    };
    let finalMeta = null;
    let songKey = "";
    let activeDifficulties = [];

    for (const file of selectedFiles) {
        const rawData = JSON.parse(await file.text());
        const song = rawData.song && typeof rawData.song === "object" ? rawData.song : rawData;
        
        const diff = getDiff(file.name);
        if (!songKey) songKey = (song.song || file.name.split("-")[0]).toLowerCase();
        if (!activeDifficulties.includes(diff)) activeDifficulties.push(diff);

        finalChart.scrollSpeed[diff] = song.speed || 2.5;
        const notesArr = [];
        let currentTime = 0;
        let lastFocus = -1;
        let bpm = song.bpm || 100;

        // Extracción de eventos de Zoom de Psych
        const psychEvents = rawData.events || song.events;
        if (Array.isArray(psychEvents)) {
            psychEvents.forEach(evGroup => {
                const evTime = parseFloat(evGroup[0]);
                const subEvents = evGroup[1];
                if (Array.isArray(subEvents)) {
                    subEvents.forEach(subEv => {
                        const evName = String(subEv[0]).toLowerCase();
                        const value1 = subEv[1];
                        if (evName.includes("zoom")) {
                            const zoomValue = parseFloat(value1) || 1.4;
                            finalChart.events.push({
                                t: evTime,
                                e: "ZoomCamera",
                                v: { ease: "expoInOut", duration: 4, mode: "stage", zoom: zoomValue }
                            });
                        }
                    });
                }
            });
        }

        song.notes?.forEach(sec => {
            if (sec.changeBPM && sec.bpm) bpm = sec.bpm;

            const focusChar = sec.mustHitSection ? 0 : 1;
            if (focusChar !== lastFocus) {
                finalChart.events.push({ t: Math.round(currentTime), e: "FocusCamera", v: { char: focusChar } });
                lastFocus = focusChar;
            }

            sec.sectionNotes?.forEach(n => {
                notesArr.push({ t: n[0], d: n[1], l: n[2] || 0, p: [] });
            });
            currentTime += (60000 / bpm) * (sec.sectionBeats || 4);
        });

        notesArr.sort((a,b) => a.t - b.t);
        finalChart.notes[diff] = notesArr;

        if (!finalMeta) {
            finalMeta = {
                version: "2.2.4",
                songName: song.song || songKey,
                artist: "Unknown",
                charter: "V-Slice Converter",
                looped: false,
                offsets: { instrumental: 0, altInstrumentals:{}, vocals:{}, altVocals:{} }
            };

            // Construcción del bloque playData interno
            let playDataObj = {};
            
            if (stickerToggle.checked) {
                playDataObj.stickerPack = stickerInput.value || "Custom Stickers";
            }
            
            playDataObj.difficulties = activeDifficulties;
            playDataObj.characters = {
                player: song.player1 || "bf",
                girlfriend: song.gfVersion || "gf",
                opponent: song.player2 || "dad",
                instrumental: "",
                opponentVocals: ["Opponent"],
                playerVocals: ["Player"]
            };
            playDataObj.stage = song.stage || "stage";
            playDataObj.noteStyle = "funkin";
            playDataObj.ratings = { easy: 3, normal: 5, hard: 6 };

            // EL ÁLBUM VA EXACTAMENTE AQUÍ (Abajo de ratings y arriba de previews de playData)
            if (albumToggle.checked) {
                playDataObj.album = albumInput.value || "Custom Album";
            }

            playDataObj.previewStart = 0;
            playDataObj.previewEnd = 0;

            finalMeta.playData = playDataObj;

            // Bloque final de la raíz de metadata
            finalMeta.generatedBy = "Chart Convert. V2 GCD";
            finalMeta.timeFormat = "ms";
            finalMeta.timeChanges = [{ t: 0, b: 0, bpm: song.bpm || 100, n: 4, d: 4, bt: [4,4,4,4] }];
        } else {
            if (!finalMeta.playData.difficulties.includes(diff)) {
                finalMeta.playData.difficulties.push(diff);
            }
        }
    }

    finalChart.events.sort((a,b) => a.t - b.t);
    
    chartArea.value = JSON.stringify(finalChart, null, 2);
    metaArea.value = JSON.stringify(finalMeta, null, 2);
    
    currentSongKey = songKey;
    downloadZipBtn.style.display = "block";
});

downloadZipBtn.addEventListener("click", async () => {
    if (!chartArea.value || !metaArea.value) return;

    const zip = new JSZip();
    zip.file(`${currentSongKey}-chart.json`, chartArea.value);
    zip.file(`${currentSongKey}-metadata.json`, metaArea.value);
    
    const content = await zip.generateAsync({type:"blob"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = `${currentSongKey}_VSlice_Pack.zip`;
    a.click();
});