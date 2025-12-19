/**
 * Middleware di gestione errori globale
 */
function errorHandler(err, req, res, next) {
    console.error("Errore nell'applicazione:", err);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Errore interno del server";

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}

module.exports = errorHandler;
