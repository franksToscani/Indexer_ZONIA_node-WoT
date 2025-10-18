const matchRepository = require("../models/matchRepository");
const tdRepository = require("../models/tdRepository");

async function getMatchesForRequest(requestId) {
    const rows = await matchRepository.findTdMatchesByRequestId(requestId);

    const seen = new Set();
    const matches = [];

    for (const row of rows) {
        if (seen.has(row.id)) {
            continue;
        }

        seen.add(row.id);
        matches.push(row.td);
    }

    return matches;
}

async function createMatchesForRequest(request) {
    const { requestId, type } = request;

    if (!requestId || !type) {
        throw new Error("La richiesta deve contenere requestId e type");
    }

    const types = Array.isArray(type) ? type : [type];
    const candidateTdIds = await tdRepository.findTdIdsByTypes(types);

    if (candidateTdIds.length === 0) {
        return [];
    }

    const existingMatches = await matchRepository.findTdIdsByRequestId(requestId);
    const existingSet = new Set(existingMatches);

    const inserted = [];

    for (const tdId of candidateTdIds) {
        if (existingSet.has(tdId)) {
            continue;
        }

        await matchRepository.insertMatch(requestId, tdId);
        inserted.push(tdId);
    }

    return inserted;
}

module.exports = {
    getMatchesForRequest,
    createMatchesForRequest,
};