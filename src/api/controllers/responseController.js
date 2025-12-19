const matchService = require("../../core/services/matchService");

async function getResponse(req, res, next) {
    try {
        const { requestId } = req.params;
        const matches = await matchService.getMatchesForRequest(requestId);

        if (matches.length === 0) {
            return res
                .status(404)
                .json({ message: "Nessun match trovato per questa richiesta." });
        }

        res.json({ requestId, matches });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getResponse,
};
