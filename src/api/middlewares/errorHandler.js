/**
/**
 * Error Handler Middleware
 * 
 * Middleware Express che cattura e formatta TUTTI gli errori
 * provenienti da controller, route, e servizi.
 * 
 * Come funziona:
 * 1. Se un controller chiama next(error) o lancia un'eccezione
 * 2. Express passa l'errore a questo middleware
 * 3. Il middleware formatta l'errore in JSON standardizzato
 * 4. Invia la risposta HTTP al client
 * 
 * Posizionamento CRITICO:
 * Questo middleware DEVE essere registrato ULTIMO in app.js
 * Altrimenti non cattura gli errori dai middleware precedenti.
 * 
 * Firma richiesta per Error Handler:
 * function(err, req, res, next) - nota: 4 parametri!
 * Senza il parametro "err" come primo, Express non lo riconosce come error handler
 */

/**
 * Gestisce gli errori non catturati dell'applicazione
 * 
 * @param {Error} err - L'oggetto errore lanciato/passato
 * @param {Object} req - Request object Express (non usato qui)
 * @param {Object} res - Response object Express
 * @param {Function} next - Callback di next (non usato qui)
 * 
 * @returns {void} - Invia una risposta JSON di errore al client
 * 
 * Formato risposta di errore:
 * Produzione:
 * {
 *   "error": "Messaggio di errore"
 * }
 * 
 * Sviluppo (NODE_ENV=development):
 * {
 *   "error": "Messaggio di errore",
 *   "stack": "Error: ...\n    at ..."
 * }
 */
function errorHandler(err, req, res, next) {
    // Stampa l'errore sulla console per debugging
    console.error("Errore nell'applicazione:", err);

    // Estrai lo status code, di default 500 (Internal Server Error)
    // Se l'errore non ha statusCode, assumi errore server generico
    const statusCode = err.statusCode || 500;
    
    // Estrai il messaggio d'errore
    const message = err.message || "Errore interno del server";

    // Crea l'oggetto risposta base
    // Sempre include: error
    res.status(statusCode).json({
        error: message,
        
        // In modalità development, aggiungi anche lo stack trace
        // Lo stack trace è utile per debugging, ma non deve essere esposto in produzione!
        // Quindi lo includiamo solo se NODE_ENV === "development"
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}

module.exports = errorHandler;
