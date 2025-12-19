const path = require("path");
const dotenv = require("dotenv");

/**
 * Entry Point di Configurazione
 * 
 * Carica il file .env e esporta la configurazione centralizzata
 * Questo viene importato da vari moduli dell'applicazione
 */

dotenv.config();

const config = require("./config");

// Esporta la configurazione per essere usata da altri moduli
module.exports = config;