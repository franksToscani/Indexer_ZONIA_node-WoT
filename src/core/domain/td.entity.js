/**
 * Thing Description Entity
 * Rappresenta una descrizione semantica di un dispositivo/servizio IoT
 */
class TdEntity {
    constructor(id, tdJson) {
        this.id = id;
        this.tdJson = tdJson;
        this.type = Array.isArray(tdJson["@type"])
            ? tdJson["@type"]
            : [tdJson["@type"]];
        this.title = tdJson.title;
        this.description = tdJson.description;
    }

    matchesTypes(types) {
        if (!Array.isArray(types) || types.length === 0) return false;
        return types.some((type) => this.type.includes(type));
    }

    toJSON() {
        return {
            id: this.id,
            ...this.tdJson,
        };
    }
}

module.exports = TdEntity;
