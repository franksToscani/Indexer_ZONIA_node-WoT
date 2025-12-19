/**
 * DTO per le risposte dell'API
 */

class ResponseDTO {
    constructor(requestId, matches) {
        this.requestId = requestId;
        this.matches = matches;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            requestId: this.requestId,
            matches: this.matches,
            count: this.matches.length,
            timestamp: this.timestamp,
        };
    }
}

module.exports = ResponseDTO;
