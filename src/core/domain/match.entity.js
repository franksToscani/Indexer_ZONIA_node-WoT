/**
 * Match Entity
 * Rappresenta l'associazione tra una richiesta e una Thing Description
 */
class MatchEntity {
    constructor(requestId, tdId, td = null) {
        this.requestId = requestId;
        this.tdId = tdId;
        this.td = td;
        this.createdAt = new Date();
    }

    toJSON() {
        return {
            requestId: this.requestId,
            tdId: this.tdId,
            td: this.td,
            createdAt: this.createdAt,
        };
    }
}

module.exports = MatchEntity;
