const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const tdRepository = require("../core/repositories/tdRepository");

/**
 * Script di Caricamento Thing Descriptions (TD)
 * 
 * Questo script legge le Thing Descriptions da un file JSON e le carica nel database PostgreSQL.
 * Deve essere eseguito PRIMA di avviare il listener.js per popolare la base dati.
 * 
 * Utilizzo (da terminale):
 * $ node src/scripts/loadTds.js
 * 
 * Il file TD deve trovarsi al percorso configurato in config.files.tdList
 * e contenere un array JSON di Thing Descriptions nel formato W3C WoT.
 * 
 * Formato atteso (tds/td_list.json):
 * [
 *   {
 *     "id": "td-001",
 *     "@context": "https://www.w3.org/2019/wot/td/v1",
 *     "@type": "Sensor",
 *     "title": "Temperature Sensor",
 *     ...
 *   },
 *   {
 *     "id": "td-002",
 *     "@type": "Sensor",
 *     "title": "Humidity Sensor",
 *     ...
 *   }
 * ]
 */

async function loadTds() {
    try {
        console.log("📂 Caricamento TD da file...");
        
        // Recupera il percorso del file dalla configurazione
        // Tipicamente: tds/td_list.json
        const filePath = config.files.tdList;
        
        // Leggi il file in formato UTF-8 (asincrono)
        // fs/promises fornisce le versioni basate su Promise
        const raw = await fs.readFile(filePath, "utf-8");
        
        // Parsifica la stringa JSON in oggetto JavaScript
        // Se il JSON è malformato, lancia un errore
        const tdArray = JSON.parse(raw);

        // Valida che il file contenga un array
        // Se è un oggetto singolo, un numero, o una stringa, rifiuta
        if (!Array.isArray(tdArray)) {
            throw new Error("Il file TD deve contenere un array JSON");
        }

        // Contatore per il feedback finale e validazione
        let inserted = 0;
        
        // Itera ogni Thing Description nel file
        for (const td of tdArray) {
            // Chiama il repository per inserire una TD nel database
            // Questo fa un INSERT INTO td_store con RETURNING id
            // L'ID viene generato dal database (serial/auto-increment)
            await tdRepository.insertTd(td);
            
            // Stampa feedback per ogni TD caricata con successo
            // Usa il field 'title' se presente, altrimenti usa 'id'
            console.log(`   ✅ Caricato: ${td.title || td.id}`);
            inserted++;
        }

        // Stampa il riepilogo finale del caricamento
        console.log(`\n✨ Caricati ${inserted} TD nel database`);
        
        // Termina il processo con codice di successo (0)
        process.exit(0);
    } catch (error) {
        // Se accade un errore (file non trovato, JSON malformato, DB non accessibile):
        // 1. Stampa il messaggio di errore
        console.error("❌ Errore:", error.message);
        
        // 2. Termina il processo con codice di errore (1)
        // Così lo script calling sa che è fallito
        process.exit(1);
    }
}

// Esegui la funzione SOLO se questo file è eseguito direttamente da terminale
// Non quando è importato come modulo
if (require.main === module) {
    loadTds();
}

module.exports = { loadTds };