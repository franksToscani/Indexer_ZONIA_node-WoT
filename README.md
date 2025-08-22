# Indexer_ZONIA_node-WoT
Implementazione di un componente Indexer che gestisce i metadati semantici secondo l'architettura ZONIA

# ZONIA Indexer – Semantic Metadata Indexer

Questo progetto è parte del sistema **ZONIA**, un'architettura zero-trust per applicazioni IoT su blockchain. Lo scopo dell'indexer è quello di gestire, memorizzare e restituire Thing Descriptions (TD) semanticamente compatibili, in risposta a richieste di oracoli esterni.

---

## Funzionalità implementate (Sprint 0 → Sprint 3)

### 🔹 Sprint 0 – Configurazione ambiente

- Node.js, Express e PostgreSQL installati
- DB `indexerDB` configurato con la tabella `td_store`
- Repo collegata a GitHub
- `.env`, `.gitignore` e struttura cartelle create

### 🔹 Sprint 1 – Caricamento TD semantiche

- Script `tdLoader.js` per importare automaticamente TD da `/tds`
- Schema con campo `jsonb` per memorizzare Thing Description
- Test query semantiche con operatori PostgreSQL su jsonb

### 🔹 Sprint 2 – Match tra richieste e TD

- Script `watchRequests.js` che simula richieste (`req-001`, `req-002`...)
- Tabella `td_matches` per salvare relazioni `request_id ↔ td_id`
- Matching semantico su `@type` delle TD
- Evitato inserimento duplicati in output con filtro in Node.js

### 🔹 Sprint 3 – API di risposta per oracles

- Endpoint `GET /response/:requestId`
- Restituisce tutte le TD matchate
- TD duplicate eliminate con filtro basato su `td.id`
- Testato con script `oracle.js`

---

## 🔌 Endpoint disponibili

### GET `/`

```txt
"Indexer ZONIA attivo!"
```

### GET `/response/:requestId`

Restituisce la lista di TD semantiche associate a una richiesta (es. `req-001`).

**Esempio:**

```bash
GET http://localhost:3000/response/req-002
```

**Risposta:**

```json
{
  "requestId": "req-002",
  "matches": [
    {
      "id": "urn:dev:ops:la-001",
      "@type": "Actuator",
      "title": "LightActuator1",
      ...
    }
  ]
}
```

---

## Come eseguire

1. Avvia il server:

```bash
node src/index.js
```

2. Esegui simulazione oracolo:

```bash
node src/oracle.js
```

3. Per ricaricare le TD:

```bash
node src/tdLoader.js
```

---

## Tecnologie usate

- Node.js / Express
- PostgreSQL con campo `jsonb`
- Librerie: `pg`, `axios`, `dotenv`, `fs`, `path`, `body-parser`

---

## ⏭Prossimo Sprint – Sprint 4

- Simulare registrazione on-chain (`registerIndexer`, `registerAvailability`)
- Logging avanzato
- Pulizia e rifinitura del codice
- Documentazione finale per tesi
