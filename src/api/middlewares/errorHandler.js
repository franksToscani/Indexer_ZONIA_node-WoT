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
 */ 

function errorHandler(err, req, res, next) {
    console.error("Errore nell'applicazione:", err);

    const statusCode = err.statusCode || 500;
    
    // Estrai il messaggio d'errore
    const message = err.message || "Errore interno del server";

    res.status(statusCode).json({
        error: message,
        
    });
}

module.exports = errorHandler;
