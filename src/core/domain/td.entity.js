/**
/**
 * Thing Description Entity
 * 
 * Modello di dominio che rappresenta una Thing Description (TD) secondo lo standard W3C WoT.
 * Incapsula un dispositivo/servizio IoT con le sue proprietà, azioni, e metadati semantici.
 * 
 * Una TD contiene informazioni come:
 * - @type: Tipo semantico (Sensor, Actuator, Controller, ecc)
 * - title: Nome leggibile
 * - description: Descrizione tesuale
 * - @context: Contesto semantico (es: https://www.w3.org/2019/wot/td/v1)
 * - properties: Proprietà leggibili/scrivibili del dispositivo
 * - actions: Azioni che il dispositivo può eseguire
 * - events: Eventi che il dispositivo può emettere
 * 
 * Questa classe fornisce:
 * - Normalizzazione del @type (array o string -> sempre array interno)
 * - Matching per ricerca semantica
 * - Serializzazione a JSON per risposte API
 */

class TdEntity {
    /**
     * Crea una nuova istanza di TdEntity
     * 
     * @param {number|string} id - ID della TD (dal database)
     * @param {Object} tdJson - L'oggetto TD completo dal database
     * @param {string|Array} tdJson["@type"] - Tipo(i) della TD
     * @param {string} tdJson.title - Nome della TD
     * @param {string} tdJson.description - Descrizione
     * 
     * @example
     * const td = new TdEntity(1, {
     *   "@type": "Sensor",
     *   "title": "Temperature Sensor",
     *   "description": "Misura la temperatura",
     *   ...
     * });
     * 
     * @note: @type può essere string o array, viene normalizzato a array internamente
     */
    constructor(id, tdJson) {
        this.id = id;
        this.tdJson = tdJson;
        
        // Normalizza @type a sempre essere un array
        // Se la TD ha "@type": "Sensor", lo converte a ["Sensor"]
        // Se la TD ha "@type": ["Sensor", "Service"], lo mantiene come array
        this.type = Array.isArray(tdJson["@type"])
            ? tdJson["@type"]
            : [tdJson["@type"]];
        
        this.title = tdJson.title;
        this.description = tdJson.description;
    }

    /**
     * Verifica se questa TD corrisponde a uno dei tipi richiesti
     * 
     * Usato dal servizio di matching per valutare se una TD
     * è compatibile con una richiesta.
     * 
     * @param {string|Array<string>} types - Tipo(i) richiesto(i)
     * @returns {boolean} true se almeno uno dei tipi richiesti è presente in questa TD
     * 
     * @example
     * const td = new TdEntity(1, { "@type": ["Sensor", "Device"], ... });
     * 
     * td.matchesTypes("Sensor") // true
     * td.matchesTypes(["Sensor"]) // true
     * td.matchesTypes("Actuator") // false
     * td.matchesTypes(["Actuator", "Sensor"]) // true (almeno "Sensor" è match)
     */
    matchesTypes(types) {
        if (!Array.isArray(types) || types.length === 0) return false;
        return types.some((type) => this.type.includes(type));
    }

    /**
     * Serializza la TD per la risposta API
     * 
     * Ritorna una copia dell'oggetto con l'ID incluso
     * (l'ID viene estratto dal database e incluso nella risposta)
     * 
     * @returns {Object} Oggetto TD con id incluso
     * 
     * @example
     * const json = td.toJSON();
     * // ritorna:
     * // {
     * //   "id": 1,
     * //   "@type": ["Sensor"],
     * //   "title": "Temperature Sensor",
     * //   ...
     * // }
     */
    toJSON() {
        return {
            id: this.id,
            // Spread del TD JSON originale mantiene tutti i campi (properties, actions, ecc)
            ...this.tdJson,
        };
    }
}

module.exports = TdEntity;
