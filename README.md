# 🌐 ZONIA Indexer – Semantic Metadata Indexer

Implementazione di un componente **Indexer** che gestisce i metadati semantici secondo l'architettura **ZONIA**, un'architettura zero-trust per applicazioni IoT su blockchain. 

Lo scopo dell'indexer è gestire, memorizzare e restituire **Thing Descriptions (TD)** semanticamente compatibili, in risposta a richieste di oracoli esterni.

---

## 📁 Architettura del Progetto

La struttura del progetto segue un approccio **Domain-Driven Design (DDD)** per garantire scalabilità e manutenibilità:

```
src/
├── config/                    # Configurazione centralizzata
│   ├── config.js             # Caricamento variabili env
│   └── index.js              # Esporta config
├── core/                      # Logica di business principale
│   ├── repositories/         # Data access layer
│   │   ├── tdRepository.js   # CRUD operazioni TD
│   │   └── matchRepository.js # CRUD operazioni matches
│   ├── services/             # Business logic
│   │   ├── matchService.js   # Matching semantico
│   │   └── tdIngestionService.js # Importazione TD
│   └── domain/               # Entity e value objects
│       ├── td.entity.js      # Thing Description entity
│       └── match.entity.js   # Match entity
├── api/                       # API layer
│   ├── controllers/          # Gestione richieste HTTP
│   │   └── responseController.js
│   ├── routes/               # Definizione rotte
│   │   └── responseRoutes.js
│   ├── middlewares/          # Middleware personalizzati
│   │   └── errorHandler.js   # Gestione errori globale
│   └── types/                # DTO e tipi API
│       └── response.dto.js
├── infrastructure/
│   └── db.js                 # Connessione PostgreSQL
├── scripts/                  # Script utili
│   ├── loadTds.js            # Importa TD da file JSON
│   └── watchRequests.js      # Elabora richieste
├── app.js                    # Configurazione Express
├── server.js                 # Avvio server
├── index.js                  # Punto di ingresso (compatibilità)
└── oracle.js                 # Script di test/simulazione
```

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

---

## 🚀 Guida di utilizzo

### Prerequisiti

- **Node.js** v14+
- **PostgreSQL** con database `indexerDB`
- **npm** (dipendenze: `express`, `body-parser`, `pg`, `dotenv`, `axios`)

### 1️⃣ Configurazione

Crea un file `.env` nella root:

```env
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/indexerDB
REQUESTS_FILE=./requests.json
TD_LIST_FILE=./tds/td_list.json
```

### 2️⃣ Installazione dipendenze

```bash
npm install
```

### 3️⃣ Caricamento TD nel database

```bash
node src/scripts/loadTds.js
```

Questo script importa le TD da `tds/td_list.json` e le memorizza in PostgreSQL.

### 4️⃣ Elaborazione richieste

```bash
node src/scripts/watchRequests.js
```

Questo script legge da `requests.json` e crea i match nel database.

### 5️⃣ Avvia il server

```bash
node src/server.js
```

Server avviato su `http://localhost:3000`

### 6️⃣ Test dell'API

```bash
node src/oracle.js
```

Script che simula richieste all'API per verificare i match.

---

## 📊 Flusso dati

```
tds/td_list.json
      ↓
  loadTds.js
      ↓
  tdIngestionService
      ↓
  tdRepository.insertTd()
      ↓
  PostgreSQL (td_store)
      
requests.json
      ↓
  watchRequests.js
      ↓
  matchService.createMatchesForRequest()
      ↓
  matchRepository.insertMatch()
      ↓
  PostgreSQL (td_matches)
      
GET /response/:requestId
      ↓
  responseController.getResponse()
      ↓
  matchService.getMatchesForRequest()
      ↓
  matchRepository.findTdMatchesByRequestId()
      ↓
  JSON response
```

---

## 🔧 Schema database

### Tabella `td_store`

```sql
CREATE TABLE td_store (
    id SERIAL PRIMARY KEY,
    td JSONB NOT NULL
);
```

### Tabella `td_matches`

```sql
CREATE TABLE td_matches (
    id SERIAL PRIMARY KEY,
    request_id TEXT NOT NULL,
    td_id INTEGER NOT NULL REFERENCES td_store(id),
    UNIQUE(request_id, td_id)
);
```

---

## 🎯 Patterns e Best Practices

### ✅ Repository Pattern
Data access centralizzato in `src/core/repositories/`

### ✅ Service Layer
Logica di business in `src/core/services/`

### ✅ Dependency Injection (DI)
Struttura modulare facilita i test

### ✅ Entity Domain Objects
Entity separate da DTO per una chiara separazione dei concerns

### ✅ Error Handling
Middleware centralizzato in `src/api/middlewares/errorHandler.js`

---

## 📝 Ambiente di sviluppo

```bash
# Avvia in modalità watch (richiede nodemon)
npm install --save-dev nodemon
npx nodemon src/server.js
```

---

## 🤝 Contribuire

Per aggiungere nuove feature:

1. Crea una nuova branch: `git checkout -b feature/nome-feature`
2. Implementa i cambiamenti
3. Fai un commit: `git commit -m "feat: descrizione"`
4. Push alla branch: `git push origin feature/nome-feature`
5. Apri una Pull Request

---

## 📄 Licenza

ISC

Eseguire il seguente comando sul database PostgreSQL utilizzato dall'indexer:

```sql
ALTER TABLE td_matches
    ADD CONSTRAINT td_matches_request_td_unique UNIQUE (request_id, td_id);
```

Se si dispone di uno script di setup/migrazione del database, aggiungere il comando precedente allo script così da mantenerlo idempotente nei nuovi ambienti.

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
