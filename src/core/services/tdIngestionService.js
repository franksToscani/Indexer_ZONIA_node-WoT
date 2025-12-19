const fs = require("fs/promises");
const path = require("path");
const config = require("../../config");
const tdRepository = require("../repositories/tdRepository");

async function importFromFile(filePath = config.paths.tdList) {
    const resolvedPath = path.resolve(filePath);
    const raw = await fs.readFile(resolvedPath, "utf-8");
    const tdArray = JSON.parse(raw);

    if (!Array.isArray(tdArray)) {
        throw new Error("Il file delle TD deve contenere un array JSON");
    }

    const inserted = [];

    for (const td of tdArray) {
        const tdId = await tdRepository.insertTd(td);
        inserted.push({
            id: tdId,
            title: td.title ?? td.id ?? null,
        });
    }

    return inserted;
}

module.exports = {
    importFromFile,
};
