# PoracleNG DTS Editor API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add API endpoints to the PoracleNG Go processor so the Poracle DTS Editor web app can load templates, retrieve field metadata, enrich webhook data, and save template changes.

**Architecture:** All new endpoints live in `processor/internal/api/dts.go` (which already has `HandleTemplateConfig` and `HandleDTSRender`). New route registrations go in `processor/cmd/processor/main.go` under the existing DTS template block (line ~388). The enrichment pipeline already exists — we add a thin API layer to expose it.

**Tech Stack:** Go, Gin, existing PoracleNG internals (enrichment, dts, gamedata, webhook)

**Context for the implementing agent:**
- The PoracleNG project root is the working directory
- Go code lives in `processor/`
- The processor binary is `processor/cmd/processor/main.go`
- API handlers are in `processor/internal/api/`
- DTS templates are in `processor/internal/dts/`
- Enrichment (computing template variables from webhooks) is in `processor/internal/enrichment/`
- Webhook type definitions are in `processor/internal/webhook/`
- The existing `POST /api/test` endpoint (in `processor/cmd/processor/test.go`) shows how to parse webhooks and run them through enrichment — follow that pattern
- Routes are registered in `main.go` using Gin: `apiGroup.POST("/path", handler)`
- All `/api/*` routes require the `X-Poracle-Secret` header (middleware already applied to `apiGroup`)
- CORS must be enabled for the DTS editor to connect from a different origin

**Reference docs:**
- DTS field reference: `DTS.md`
- API reference: `API.md`
- Project structure: `CLAUDE.md`

---

## What Exists Today

| Endpoint | Handler | What it does | What's missing for the editor |
|----------|---------|-------------|-------------------------------|
| `GET /api/config/templates` | `HandleTemplateConfig` in `api/dts.go` | Returns template **metadata** (type→platform→language→IDs). Does NOT return template content. | Need actual template content (Handlebars JSON) |
| `POST /api/dts/render` | `HandleDTSRender` in `api/dts.go` | Takes a view (variable map) + template ref, renders through Handlebars, returns rendered JSON. Requires caller to already have the variable map. | Need an endpoint that takes a raw **webhook** and returns the enriched variable map |
| `POST /api/test` | `HandleTest` in `api/test_api.go` | Enqueues a webhook into the full pipeline (enrichment → render → delivery). Sends the actual message to Discord/Telegram. | We want enrichment only, no delivery. And we want the variable map back, not just a success message |
| `GET /api/masterdata/monsters` | `HandleMasterdataMonsters` | Returns all pokemon with names/forms/types | Already sufficient for the editor |
| `GET /api/masterdata/grunts` | `HandleMasterdataGrunts` | Returns grunt types | Already sufficient |

## What We Need to Add

1. **`GET /api/dts/templates`** — Return actual template content (Handlebars JSON), filterable
2. **`POST /api/dts/templates`** — Save modified templates back to dts.json
3. **`POST /api/dts/enrich`** — Take a raw webhook, run it through the enrichment pipeline, return the variable map (no rendering, no delivery)
4. **`GET /api/dts/fields/{type}`** — Return field metadata with preferred/deprecated/rawWebhook flags and block scopes
5. **CORS middleware** — Allow the editor to connect from a different origin

---

## File Structure

### Files to modify
- `processor/internal/api/dts.go` — add new handler functions
- `processor/internal/dts/templates.go` — add methods to TemplateStore for reading/writing entries
- `processor/cmd/processor/main.go` — register new routes

### Files to create
- `processor/internal/api/dts_fields.go` — field definitions and metadata handler
- `processor/internal/api/dts_enrich.go` — webhook enrichment handler
- `processor/internal/api/cors.go` — CORS middleware
- `processor/internal/api/dts_test.go` — tests for new handlers
- `processor/internal/api/dts_fields_test.go` — tests for field metadata

---

## Task 1: CORS Middleware

**Files:**
- Create: `processor/internal/api/cors.go`
- Modify: `processor/cmd/processor/main.go`

The DTS editor runs on a different origin (e.g. localhost:3000) and needs to make API calls to the processor (e.g. localhost:3030). Without CORS headers, browsers block these requests.

- [ ] **Step 1: Create CORS middleware**

Create `processor/internal/api/cors.go`:

```go
package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CORSMiddleware adds permissive CORS headers for the DTS editor.
// Only applied to /api/* routes which are already protected by the API secret.
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, X-Poracle-Secret")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
```

- [ ] **Step 2: Register CORS middleware in main.go**

In `processor/cmd/processor/main.go`, add the CORS middleware to the API group. Find the line:

```go
apiGroup := r.Group("/api")
apiGroup.Use(api.RequireSecretGin(cfg.Processor.APISecret))
```

Add CORS before the secret middleware (so OPTIONS preflight requests pass without a secret):

```go
apiGroup := r.Group("/api")
apiGroup.Use(api.CORSMiddleware())
apiGroup.Use(api.RequireSecretGin(cfg.Processor.APISecret))
```

- [ ] **Step 3: Verify CORS headers**

Run the processor and test:

```bash
curl -i -X OPTIONS http://localhost:3030/api/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-Poracle-Secret"
```

Expected: 204 response with `Access-Control-Allow-Origin: *` header.

- [ ] **Step 4: Commit**

```bash
git add processor/internal/api/cors.go processor/cmd/processor/main.go
git commit -m "feat: add CORS middleware for DTS editor cross-origin requests"
```

---

## Task 2: GET /api/dts/templates — Return Template Content

**Files:**
- Modify: `processor/internal/dts/templates.go` (add `Entries()` method)
- Modify: `processor/internal/api/dts.go` (add handler)
- Modify: `processor/cmd/processor/main.go` (register route)

- [ ] **Step 1: Add `Entries()` method to TemplateStore**

In `processor/internal/dts/templates.go`, add a method that returns entries filtered by query params:

```go
// FilteredEntries returns DTS entries matching the given filters.
// Empty filter values match all entries for that dimension.
func (ts *TemplateStore) FilteredEntries(filterType, filterPlatform, filterLanguage, filterID string) []DTSEntry {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	var result []DTSEntry
	for _, e := range ts.entries {
		if filterType != "" && e.Type != filterType {
			continue
		}
		if filterPlatform != "" && e.Platform != filterPlatform {
			continue
		}
		if filterLanguage != "" && e.Language != filterLanguage {
			continue
		}
		if filterID != "" && strings.ToLower(e.ID.String()) != strings.ToLower(filterID) {
			continue
		}
		result = append(result, e)
	}
	return result
}
```

- [ ] **Step 2: Add handler in api/dts.go**

Add to `processor/internal/api/dts.go`:

```go
// HandleDTSGetTemplates returns DTS template entries with full content.
// GET /api/dts/templates?type=monster&platform=discord&language=en&id=1
func HandleDTSGetTemplates(ts *dts.TemplateStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		entries := ts.FilteredEntries(
			c.Query("type"),
			c.Query("platform"),
			c.Query("language"),
			c.Query("id"),
		)
		c.JSON(http.StatusOK, gin.H{"status": "ok", "templates": entries})
	}
}
```

- [ ] **Step 3: Register route in main.go**

In `processor/cmd/processor/main.go`, inside the `if proc.dtsRenderer != nil` block (around line 389), add:

```go
apiGroup.GET("/dts/templates", api.HandleDTSGetTemplates(proc.dtsRenderer.Templates()))
```

- [ ] **Step 4: Test the endpoint**

```bash
curl -s -H "X-Poracle-Secret: $SECRET" \
  "http://localhost:3030/api/dts/templates?type=monster&platform=discord&language=en" | jq '.templates[0].template'
```

Expected: Returns the actual Handlebars template JSON object for the monster Discord template.

- [ ] **Step 5: Commit**

```bash
git add processor/internal/dts/templates.go processor/internal/api/dts.go processor/cmd/processor/main.go
git commit -m "feat: add GET /api/dts/templates endpoint returning template content"
```

---

## Task 3: POST /api/dts/templates — Save Template Changes

**Files:**
- Modify: `processor/internal/dts/templates.go` (add `UpdateEntries()` and `SaveToFile()`)
- Modify: `processor/internal/api/dts.go` (add handler)
- Modify: `processor/cmd/processor/main.go` (register route)

- [ ] **Step 1: Add update and save methods to TemplateStore**

In `processor/internal/dts/templates.go`:

```go
// UpdateEntries merges incoming entries into the store. Entries are matched by
// (type, platform, language, id). Matching entries are updated; new entries are
// appended. Returns the number of updated and inserted entries.
func (ts *TemplateStore) UpdateEntries(incoming []DTSEntry) (updated, inserted int) {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	for _, inc := range incoming {
		found := false
		for i := range ts.entries {
			e := &ts.entries[i]
			if e.Type == inc.Type &&
				e.Platform == inc.Platform &&
				e.Language == inc.Language &&
				strings.ToLower(e.ID.String()) == strings.ToLower(inc.ID.String()) {
				// Update in place
				e.Template = inc.Template
				e.TemplateFile = inc.TemplateFile
				e.Name = inc.Name
				e.Description = inc.Description
				e.Default = inc.Default
				e.Hidden = inc.Hidden
				found = true
				updated++
				break
			}
		}
		if !found {
			ts.entries = append(ts.entries, inc)
			inserted++
		}
	}

	// Clear compiled template cache — entries have changed
	ts.cache = make(map[string]*raymond.Template)
	return
}

// SaveToFile writes all current entries to configDir/dts.json.
func (ts *TemplateStore) SaveToFile() error {
	ts.mu.RLock()
	defer ts.mu.RUnlock()

	path := filepath.Join(ts.configDir, "dts.json")

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(ts.entries); err != nil {
		return fmt.Errorf("marshal entries: %w", err)
	}

	if err := os.WriteFile(path, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("write %s: %w", path, err)
	}

	log.Infof("dts: saved %d entries to %s", len(ts.entries), path)
	return nil
}
```

- [ ] **Step 2: Add handler in api/dts.go**

```go
// HandleDTSSaveTemplates accepts an array of DTS entries and saves them.
// POST /api/dts/templates
func HandleDTSSaveTemplates(ts *dts.TemplateStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		var entries []dts.DTSEntry
		if err := c.ShouldBindJSON(&entries); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "invalid request body: " + err.Error()})
			return
		}

		updated, inserted := ts.UpdateEntries(entries)

		if err := ts.SaveToFile(); err != nil {
			log.Errorf("dts: save failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "save failed: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"updated":  updated,
			"inserted": inserted,
		})
	}
}
```

- [ ] **Step 3: Register route in main.go**

Inside the `if proc.dtsRenderer != nil` block:

```go
apiGroup.POST("/dts/templates", api.HandleDTSSaveTemplates(proc.dtsRenderer.Templates()))
```

- [ ] **Step 4: Test the endpoint**

```bash
curl -s -X POST -H "X-Poracle-Secret: $SECRET" -H "Content-Type: application/json" \
  http://localhost:3030/api/dts/templates \
  -d '[{"id":"99","type":"monster","platform":"discord","language":"en","template":{"embed":{"title":"Test {{name}}"}}}]' | jq .
```

Expected: `{"status":"ok","updated":0,"inserted":1}`. Verify `config/dts.json` now contains the new entry.

- [ ] **Step 5: Commit**

```bash
git add processor/internal/dts/templates.go processor/internal/api/dts.go processor/cmd/processor/main.go
git commit -m "feat: add POST /api/dts/templates endpoint for saving template changes"
```

---

## Task 4: POST /api/dts/enrich — Webhook Enrichment

**Files:**
- Create: `processor/internal/api/dts_enrich.go`
- Modify: `processor/cmd/processor/main.go` (register route)

This is the key endpoint for the editor. It takes a raw webhook payload and type, runs it through the same enrichment pipeline as the real alert path, and returns the enriched variable map — the data that gets passed to Handlebars.

The enrichment pipeline is already used by `processTestPokemon` etc. in `test.go`. We follow the same pattern but return the enriched data instead of rendering and delivering.

- [ ] **Step 1: Create the enrichment handler**

Create `processor/internal/api/dts_enrich.go`:

```go
package api

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// EnrichService is the interface the handler needs from ProcessorService.
// This avoids importing the main package.
type EnrichService interface {
	EnrichWebhook(webhookType string, raw json.RawMessage, language string) (map[string]any, error)
}

// HandleDTSEnrich runs a webhook through the enrichment pipeline and returns the variable map.
// POST /api/dts/enrich
//
// Request body:
//
//	{"type": "pokemon", "webhook": {...raw webhook JSON...}, "language": "en"}
//
// Response:
//
//	{"status": "ok", "variables": {...enriched fields...}}
func HandleDTSEnrich(svc EnrichService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Type     string          `json:"type"`
			Webhook  json.RawMessage `json:"webhook"`
			Language string          `json:"language"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "invalid request body: " + err.Error()})
			return
		}

		if req.Type == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "type is required"})
			return
		}
		if len(req.Webhook) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "webhook is required"})
			return
		}
		if req.Language == "" {
			req.Language = "en"
		}

		variables, err := svc.EnrichWebhook(req.Type, req.Webhook, req.Language)
		if err != nil {
			log.Errorf("dts enrich: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok", "variables": variables})
	}
}
```

- [ ] **Step 2: Implement EnrichWebhook on ProcessorService**

In `processor/cmd/processor/test.go` (or a new file `processor/cmd/processor/enrich.go`), add a method that reuses the enrichment logic from the test handlers but returns the variable map instead of enqueuing a render job.

Create `processor/cmd/processor/enrich.go`:

```go
package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/pokemon/poracleng/processor/internal/webhook"
)

// EnrichWebhook runs a raw webhook through the enrichment pipeline and returns
// the variable map that would be passed to Handlebars during template rendering.
// This is used by the DTS editor to show realistic previews.
func (ps *ProcessorService) EnrichWebhook(webhookType string, raw json.RawMessage, language string) (map[string]any, error) {
	switch webhookType {
	case "pokemon":
		return ps.enrichPokemon(raw, language)
	case "raid":
		return ps.enrichRaid(raw, language, false)
	case "egg":
		return ps.enrichRaid(raw, language, true)
	case "quest":
		return ps.enrichQuest(raw, language)
	case "invasion":
		return ps.enrichInvasion(raw, language)
	case "lure":
		return ps.enrichLure(raw, language)
	case "nest":
		return ps.enrichNest(raw, language)
	case "gym":
		return ps.enrichGym(raw, language)
	case "fort_update":
		return ps.enrichFort(raw, language)
	default:
		return nil, fmt.Errorf("unsupported webhook type: %s", webhookType)
	}
}

func (ps *ProcessorService) enrichPokemon(raw json.RawMessage, language string) (map[string]any, error) {
	var pokemon webhook.PokemonWebhook
	if err := json.Unmarshal(raw, &pokemon); err != nil {
		return nil, fmt.Errorf("parse pokemon: %w", err)
	}

	// Freshen disappear time if it's in the past (test data)
	if pokemon.DisappearTime > 0 && pokemon.DisappearTime < time.Now().Unix() {
		pokemon.DisappearTime = time.Now().Unix() + 600
	}

	rarityGroup := ps.stats.GetRarityGroup(pokemon.PokemonID)
	shinyPossible := ps.stats.IsShinyPossible(pokemon.PokemonID, pokemon.Form)
	view := ps.enricher.EnrichPokemon(&pokemon, language, rarityGroup, shinyPossible)
	return view, nil
}

func (ps *ProcessorService) enrichRaid(raw json.RawMessage, language string, isEgg bool) (map[string]any, error) {
	var raid webhook.RaidWebhook
	if err := json.Unmarshal(raw, &raid); err != nil {
		return nil, fmt.Errorf("parse raid: %w", err)
	}

	// Freshen times
	if raid.Start > 0 && raid.End < time.Now().Unix() {
		raid.Start = time.Now().Unix() + 600
		raid.End = raid.Start + 1800
	}

	view := ps.enricher.EnrichRaid(&raid, language)
	return view, nil
}

func (ps *ProcessorService) enrichQuest(raw json.RawMessage, language string) (map[string]any, error) {
	var quest webhook.QuestWebhook
	if err := json.Unmarshal(raw, &quest); err != nil {
		return nil, fmt.Errorf("parse quest: %w", err)
	}
	view := ps.enricher.EnrichQuest(&quest, language)
	return view, nil
}

func (ps *ProcessorService) enrichInvasion(raw json.RawMessage, language string) (map[string]any, error) {
	var inv webhook.InvasionWebhook
	if err := json.Unmarshal(raw, &inv); err != nil {
		return nil, fmt.Errorf("parse invasion: %w", err)
	}
	if inv.IncidentExpiration > 0 && inv.IncidentExpiration < time.Now().Unix() {
		inv.IncidentExpiration = time.Now().Unix() + 600
	}
	view := ps.enricher.EnrichInvasion(&inv, language)
	return view, nil
}

func (ps *ProcessorService) enrichLure(raw json.RawMessage, language string) (map[string]any, error) {
	var lure webhook.LureWebhook
	if err := json.Unmarshal(raw, &lure); err != nil {
		return nil, fmt.Errorf("parse lure: %w", err)
	}
	view := ps.enricher.EnrichLure(&lure, language)
	return view, nil
}

func (ps *ProcessorService) enrichNest(raw json.RawMessage, language string) (map[string]any, error) {
	var nest webhook.NestWebhook
	if err := json.Unmarshal(raw, &nest); err != nil {
		return nil, fmt.Errorf("parse nest: %w", err)
	}
	view := ps.enricher.EnrichNest(&nest, language)
	return view, nil
}

func (ps *ProcessorService) enrichGym(raw json.RawMessage, language string) (map[string]any, error) {
	var gym webhook.GymWebhook
	if err := json.Unmarshal(raw, &gym); err != nil {
		return nil, fmt.Errorf("parse gym: %w", err)
	}
	view := ps.enricher.EnrichGym(&gym, language)
	return view, nil
}

func (ps *ProcessorService) enrichFort(raw json.RawMessage, language string) (map[string]any, error) {
	var fort webhook.FortWebhook
	if err := json.Unmarshal(raw, &fort); err != nil {
		return nil, fmt.Errorf("parse fort: %w", err)
	}
	view := ps.enricher.EnrichFort(&fort, language)
	return view, nil
}
```

**Note for implementing agent:** The exact webhook types (`PokemonWebhook`, `RaidWebhook`, etc.) and enricher methods (`EnrichPokemon`, `EnrichRaid`, etc.) already exist — check `processor/internal/webhook/` for type names and `processor/internal/enrichment/` for method signatures. The code above shows the pattern; adjust type names and method signatures to match what actually exists in the codebase. Look at the existing `processTestPokemon` in `test.go` to see the real enrichment call pattern.

- [ ] **Step 3: Register route in main.go**

Inside the `if proc.dtsRenderer != nil` block:

```go
apiGroup.POST("/dts/enrich", api.HandleDTSEnrich(proc))
```

This works because `ProcessorService` now implements `EnrichService` via the `EnrichWebhook` method.

- [ ] **Step 4: Test the endpoint**

Use test data from `config/testdata.json`:

```bash
curl -s -X POST -H "X-Poracle-Secret: $SECRET" -H "Content-Type: application/json" \
  http://localhost:3030/api/dts/enrich \
  -d '{"type":"pokemon","webhook":{"encounter_id":"123","pokemon_id":129,"spawnpoint_id":456,"latitude":51.28,"longitude":1.08,"disappear_time":9999999999,"cp_multiplier":0.694144,"pokemon_level":27,"form":253,"costume":0,"cp":212,"individual_attack":15,"individual_defense":15,"individual_stamina":15,"move_1":231,"move_2":133,"weight":7.81,"height":0.87,"gender":1}}' | jq '.variables | {name, fullName, iv, cp, level, quickMoveName, chargeMoveName}'
```

Expected: Returns enriched fields like `name: "Magikarp"`, `iv: 100`, `quickMoveName: "Splash"`, etc.

- [ ] **Step 5: Commit**

```bash
git add processor/internal/api/dts_enrich.go processor/cmd/processor/enrich.go processor/cmd/processor/main.go
git commit -m "feat: add POST /api/dts/enrich endpoint for webhook enrichment"
```

---

## Task 5: GET /api/dts/fields/{type} — Field Metadata

**Files:**
- Create: `processor/internal/api/dts_fields.go`
- Modify: `processor/cmd/processor/main.go` (register route)

Returns field metadata for the DTS editor's tag picker. Fields include preferred/deprecated/rawWebhook flags and block scope definitions. This is derived from DTS.md but served as structured data.

- [ ] **Step 1: Create the field definitions**

Create `processor/internal/api/dts_fields.go`:

```go
package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// FieldDef describes a single template field for the DTS editor.
type FieldDef struct {
	Name                 string `json:"name"`
	Type                 string `json:"type"`
	Description          string `json:"description"`
	Category             string `json:"category"`
	Preferred            bool   `json:"preferred,omitempty"`
	Deprecated           bool   `json:"deprecated,omitempty"`
	RawWebhook           bool   `json:"rawWebhook,omitempty"`
	PreferredAlternative string `json:"preferredAlternative,omitempty"`
}

// BlockScope describes fields available inside a block helper context.
type BlockScope struct {
	Helper      string     `json:"helper"`
	Args        []string   `json:"args,omitempty"`
	Description string     `json:"description"`
	Fields      []FieldDef `json:"fields"`
	// IterableFields lists top-level fields that can be iterated with {{#each}}
	IterableFields []string `json:"iterableFields,omitempty"`
}

var commonFields = []FieldDef{
	{Name: "latitude", Type: "number", Description: "Alert location latitude", Category: "location", Preferred: true},
	{Name: "longitude", Type: "number", Description: "Alert location longitude", Category: "location", Preferred: true},
	{Name: "addr", Type: "string", Description: "Formatted address", Category: "location", Preferred: true},
	{Name: "streetName", Type: "string", Description: "Street name", Category: "location"},
	{Name: "city", Type: "string", Description: "City name", Category: "location"},
	{Name: "country", Type: "string", Description: "Country name", Category: "location"},
	{Name: "flag", Type: "string", Description: "Country flag emoji", Category: "location"},
	{Name: "areas", Type: "string", Description: "Comma-separated matched areas", Category: "location"},
	{Name: "staticMap", Type: "string", Description: "Static map image URL", Category: "maps", Preferred: true},
	{Name: "staticmap", Type: "string", Description: "Deprecated alias for staticMap", Category: "maps", Deprecated: true, PreferredAlternative: "staticMap"},
	{Name: "imgUrl", Type: "string", Description: "Primary icon URL", Category: "maps", Preferred: true},
	{Name: "googleMapUrl", Type: "string", Description: "Google Maps link", Category: "maps", Preferred: true},
	{Name: "appleMapUrl", Type: "string", Description: "Apple Maps link", Category: "maps", Preferred: true},
	{Name: "wazeMapUrl", Type: "string", Description: "Waze link", Category: "maps"},
	{Name: "mapurl", Type: "string", Description: "Deprecated alias for googleMapUrl", Category: "maps", Deprecated: true, PreferredAlternative: "googleMapUrl"},
	{Name: "applemap", Type: "string", Description: "Deprecated alias for appleMapUrl", Category: "maps", Deprecated: true, PreferredAlternative: "appleMapUrl"},
	{Name: "tthd", Type: "int", Description: "Days remaining", Category: "time"},
	{Name: "tthh", Type: "int", Description: "Hours remaining", Category: "time", Preferred: true},
	{Name: "tthm", Type: "int", Description: "Minutes remaining", Category: "time", Preferred: true},
	{Name: "tths", Type: "int", Description: "Seconds remaining", Category: "time", Preferred: true},
	{Name: "now", Type: "string", Description: "Current date/time", Category: "time"},
	{Name: "distance", Type: "number", Description: "Distance from user", Category: "location"},
	{Name: "bearing", Type: "int", Description: "Bearing degrees from user", Category: "location"},
	{Name: "bearingEmoji", Type: "string", Description: "Directional arrow emoji", Category: "location"},
}

var monsterFields = []FieldDef{
	// Identity
	{Name: "name", Type: "string", Description: "Translated pokemon name", Category: "identity", Preferred: true},
	{Name: "fullName", Type: "string", Description: "Name + form combined", Category: "identity", Preferred: true},
	{Name: "formName", Type: "string", Description: "Translated form name", Category: "identity", Preferred: true},
	{Name: "pokemonId", Type: "int", Description: "Pokemon ID", Category: "identity", Preferred: true},
	{Name: "pokemon_id", Type: "int", Description: "Pokemon ID (webhook)", Category: "identity", RawWebhook: true, PreferredAlternative: "pokemonId"},
	{Name: "formId", Type: "int", Description: "Form ID", Category: "identity", Preferred: true},
	{Name: "nameEng", Type: "string", Description: "English pokemon name", Category: "identity"},
	{Name: "fullNameEng", Type: "string", Description: "English name + form", Category: "identity"},
	// Stats
	{Name: "iv", Type: "number", Description: "IV percentage (0-100)", Category: "stats", Preferred: true},
	{Name: "atk", Type: "int", Description: "Attack IV (0-15)", Category: "stats", Preferred: true},
	{Name: "def", Type: "int", Description: "Defense IV (0-15)", Category: "stats", Preferred: true},
	{Name: "sta", Type: "int", Description: "Stamina IV (0-15)", Category: "stats", Preferred: true},
	{Name: "cp", Type: "int", Description: "Combat Power", Category: "stats", Preferred: true},
	{Name: "level", Type: "int", Description: "Pokemon level", Category: "stats", Preferred: true},
	{Name: "ivColor", Type: "string", Description: "Hex color based on IV range", Category: "stats", Preferred: true},
	{Name: "weight", Type: "string", Description: "Weight in kg", Category: "stats"},
	{Name: "height", Type: "string", Description: "Height in m", Category: "stats"},
	{Name: "individual_attack", Type: "int", Description: "Attack IV (webhook)", Category: "stats", Deprecated: true, PreferredAlternative: "atk"},
	{Name: "individual_defense", Type: "int", Description: "Defense IV (webhook)", Category: "stats", Deprecated: true, PreferredAlternative: "def"},
	{Name: "individual_stamina", Type: "int", Description: "Stamina IV (webhook)", Category: "stats", Deprecated: true, PreferredAlternative: "sta"},
	// Moves
	{Name: "quickMoveName", Type: "string", Description: "Translated fast move name", Category: "moves", Preferred: true},
	{Name: "chargeMoveName", Type: "string", Description: "Translated charged move name", Category: "moves", Preferred: true},
	{Name: "quickMoveEmoji", Type: "string", Description: "Fast move type emoji", Category: "moves"},
	{Name: "chargeMoveEmoji", Type: "string", Description: "Charged move type emoji", Category: "moves"},
	{Name: "quickMoveId", Type: "int", Description: "Fast move ID", Category: "moves"},
	{Name: "chargeMoveId", Type: "int", Description: "Charged move ID", Category: "moves"},
	{Name: "move_1", Type: "int", Description: "Fast move ID (webhook)", Category: "moves", Deprecated: true, PreferredAlternative: "quickMoveId"},
	{Name: "move_2", Type: "int", Description: "Charged move ID (webhook)", Category: "moves", Deprecated: true, PreferredAlternative: "chargeMoveId"},
	// Time
	{Name: "time", Type: "string", Description: "Disappear time (formatted)", Category: "time", Preferred: true},
	{Name: "disappearTime", Type: "string", Description: "Same as time", Category: "time"},
	{Name: "confirmedTime", Type: "bool", Description: "Is disappear time verified", Category: "time"},
	{Name: "distime", Type: "string", Description: "Deprecated alias for disappearTime", Category: "time", Deprecated: true, PreferredAlternative: "disappearTime"},
	// Weather
	{Name: "boostWeatherEmoji", Type: "string", Description: "Boost weather emoji", Category: "weather", Preferred: true},
	{Name: "boostWeatherName", Type: "string", Description: "Translated boost weather", Category: "weather"},
	{Name: "boosted", Type: "bool", Description: "Is weather boosted", Category: "weather"},
	{Name: "weatherChange", Type: "string", Description: "Weather forecast text", Category: "weather"},
	// PVP
	{Name: "pvpGreat", Type: "array", Description: "Great League PVP display list", Category: "pvp", Preferred: true},
	{Name: "pvpUltra", Type: "array", Description: "Ultra League PVP display list", Category: "pvp", Preferred: true},
	{Name: "pvpLittle", Type: "array", Description: "Little League PVP display list", Category: "pvp"},
	// Other
	{Name: "generation", Type: "int", Description: "Generation number", Category: "other"},
	{Name: "genderData", Type: "object", Description: "{name, emoji}", Category: "other"},
	{Name: "shinyPossible", Type: "bool", Description: "Can be shiny", Category: "other"},
	{Name: "color", Type: "string", Description: "Primary type color hex", Category: "other"},
	{Name: "encountered", Type: "bool", Description: "Has IV data", Category: "other"},
}

// Add other types following the same pattern (raid, egg, quest, invasion, lure, nest, gym).
// Reference: DTS.md in the project root.

var raidFields = []FieldDef{
	{Name: "name", Type: "string", Description: "Translated pokemon name", Category: "identity", Preferred: true},
	{Name: "fullName", Type: "string", Description: "Name + form", Category: "identity", Preferred: true},
	{Name: "level", Type: "int", Description: "Raid level", Category: "identity", Preferred: true},
	{Name: "levelName", Type: "string", Description: "Raid level name", Category: "identity", Preferred: true},
	{Name: "gymName", Type: "string", Description: "Gym name", Category: "gym", Preferred: true},
	{Name: "gym_name", Type: "string", Description: "Gym name (webhook)", Category: "gym", RawWebhook: true, PreferredAlternative: "gymName"},
	{Name: "gymColor", Type: "string", Description: "Team color hex", Category: "gym"},
	{Name: "ex", Type: "bool", Description: "EX raid eligible", Category: "gym"},
	{Name: "time", Type: "string", Description: "End time", Category: "time", Preferred: true},
	{Name: "cp", Type: "int", Description: "Boss CP", Category: "stats", Preferred: true},
	{Name: "quickMoveName", Type: "string", Description: "Translated fast move", Category: "moves", Preferred: true},
	{Name: "chargeMoveName", Type: "string", Description: "Translated charged move", Category: "moves", Preferred: true},
}

var eggFields = []FieldDef{
	{Name: "level", Type: "int", Description: "Egg level", Category: "identity", Preferred: true},
	{Name: "levelName", Type: "string", Description: "Raid level name", Category: "identity", Preferred: true},
	{Name: "gymName", Type: "string", Description: "Gym name", Category: "gym", Preferred: true},
	{Name: "gymColor", Type: "string", Description: "Team color hex", Category: "gym"},
	{Name: "ex", Type: "bool", Description: "EX raid eligible", Category: "gym"},
	{Name: "time", Type: "string", Description: "Hatch time", Category: "time", Preferred: true},
}

var questFields = []FieldDef{
	{Name: "pokestopName", Type: "string", Description: "Pokestop name", Category: "location", Preferred: true},
	{Name: "questString", Type: "string", Description: "Quest description", Category: "quest", Preferred: true},
	{Name: "rewardString", Type: "string", Description: "Reward description", Category: "quest", Preferred: true},
}

var invasionFields = []FieldDef{
	{Name: "pokestopName", Type: "string", Description: "Pokestop name", Category: "location", Preferred: true},
	{Name: "gruntType", Type: "string", Description: "Grunt type", Category: "invasion", Preferred: true},
	{Name: "gruntTypeEmoji", Type: "string", Description: "Grunt type emoji", Category: "invasion"},
	{Name: "gruntTypeColor", Type: "string", Description: "Grunt type color hex", Category: "invasion"},
	{Name: "genderData", Type: "object", Description: "{name, emoji}", Category: "invasion"},
	{Name: "gruntRewardsList", Type: "object", Description: "Reward pokemon lists", Category: "invasion"},
	{Name: "time", Type: "string", Description: "End time", Category: "time", Preferred: true},
}

var pvpEntryFields = []FieldDef{
	{Name: "rank", Type: "int", Description: "PVP rank"},
	{Name: "cp", Type: "int", Description: "CP at this rank"},
	{Name: "fullName", Type: "string", Description: "Pokemon name + form"},
	{Name: "level", Type: "number", Description: "Level at this rank"},
	{Name: "levelWithCap", Type: "string", Description: "Level with cap notation"},
	{Name: "percentage", Type: "number", Description: "Stat product percentage"},
	{Name: "cap", Type: "int", Description: "Level cap"},
}

var monsterBlockScopes = []BlockScope{
	{
		Helper:         "each",
		IterableFields: []string{"pvpGreat", "pvpUltra", "pvpLittle", "matched", "weaknessList"},
		Description:    "Iterate over arrays",
		Fields:         pvpEntryFields,
	},
	{
		Helper:      "pokemon",
		Args:        []string{"id", "form"},
		Description: "Pokemon data block helper",
		Fields: []FieldDef{
			{Name: "name", Type: "string", Description: "Translated pokemon name"},
			{Name: "nameEng", Type: "string", Description: "English pokemon name"},
			{Name: "fullName", Type: "string", Description: "Name + form"},
			{Name: "formName", Type: "string", Description: "Translated form name"},
			{Name: "typeName", Type: "array", Description: "Type names"},
			{Name: "typeEmoji", Type: "array", Description: "Type emojis"},
			{Name: "baseStats", Type: "object", Description: "{baseAttack, baseDefense, baseStamina}"},
			{Name: "hasEvolutions", Type: "bool", Description: "Has evolutions"},
		},
	},
	{
		Helper:      "getPowerUpCost",
		Args:        []string{"levelStart", "levelEnd"},
		Description: "Power-up cost between two levels",
		Fields: []FieldDef{
			{Name: "stardust", Type: "int", Description: "Stardust cost"},
			{Name: "candy", Type: "int", Description: "Candy cost"},
			{Name: "xlCandy", Type: "int", Description: "XL Candy cost"},
		},
	},
}

var fieldsByType = map[string]struct {
	Fields      []FieldDef
	BlockScopes []BlockScope
}{
	"monster":     {Fields: append(commonFields, monsterFields...), BlockScopes: monsterBlockScopes},
	"monsterNoIv": {Fields: append(commonFields, monsterFields...), BlockScopes: monsterBlockScopes},
	"raid":        {Fields: append(commonFields, raidFields...)},
	"egg":         {Fields: append(commonFields, eggFields...)},
	"quest":       {Fields: append(commonFields, questFields...)},
	"invasion":    {Fields: append(commonFields, invasionFields...)},
}

// HandleDTSFields returns available template fields for a DTS type.
// GET /api/dts/fields/:type
func HandleDTSFields() gin.HandlerFunc {
	return func(c *gin.Context) {
		typeName := c.Param("type")

		entry, ok := fieldsByType[typeName]
		if !ok {
			// Return just common fields for unknown types
			c.JSON(http.StatusOK, gin.H{
				"status": "ok",
				"fields": commonFields,
			})
			return
		}

		resp := gin.H{
			"status": "ok",
			"fields": entry.Fields,
		}
		if len(entry.BlockScopes) > 0 {
			resp["blockScopes"] = entry.BlockScopes
		}
		c.JSON(http.StatusOK, resp)
	}
}
```

- [ ] **Step 2: Register route in main.go**

Inside the `if proc.dtsRenderer != nil` block:

```go
apiGroup.GET("/dts/fields/:type", api.HandleDTSFields())
```

- [ ] **Step 3: Test the endpoint**

```bash
curl -s -H "X-Poracle-Secret: $SECRET" \
  http://localhost:3030/api/dts/fields/monster | jq '.fields[:3]'
```

Expected: Returns field objects with `name`, `type`, `description`, `category`, `preferred`, `deprecated`, `rawWebhook` fields.

```bash
curl -s -H "X-Poracle-Secret: $SECRET" \
  http://localhost:3030/api/dts/fields/monster | jq '.blockScopes[0]'
```

Expected: Returns the `each` block scope with `iterableFields` and PVP entry fields.

- [ ] **Step 4: Commit**

```bash
git add processor/internal/api/dts_fields.go processor/cmd/processor/main.go
git commit -m "feat: add GET /api/dts/fields/:type endpoint with field metadata and block scopes"
```

---

## Task 6: Update API.md Documentation

**Files:**
- Modify: `API.md`

- [ ] **Step 1: Add new endpoint documentation**

Append the new endpoints to the DTS section in `API.md`:

```markdown
## DTS Editor

### GET /api/dts/templates

Returns DTS template entries with full template content. Filterable by query parameters.

| Parameter | Description |
|-----------|-------------|
| `type` | Filter by DTS type (monster, raid, egg, etc.) |
| `platform` | Filter by platform (discord, telegram) |
| `language` | Filter by language (en, de, etc.) |
| `id` | Filter by template ID |

```bash
curl -H "X-Poracle-Secret: secret" "http://localhost:3030/api/dts/templates?type=monster&platform=discord"
```

```json
{
  "status": "ok",
  "templates": [
    {
      "id": "1",
      "type": "monster",
      "platform": "discord",
      "language": "en",
      "default": true,
      "template": {"embed": {"title": "{{round iv}}% {{fullName}} ...", ...}}
    }
  ]
}
```

### POST /api/dts/templates

Save modified DTS template entries. Entries are matched by (type, platform, language, id) — matching entries are updated, new entries are inserted. Changes are written to `config/dts.json`.

```bash
curl -X POST -H "X-Poracle-Secret: secret" -H "Content-Type: application/json" \
  http://localhost:3030/api/dts/templates \
  -d '[{"id":"1","type":"monster","platform":"discord","language":"en","template":{"embed":{...}}}]'
```

```json
{"status": "ok", "updated": 1, "inserted": 0}
```

### POST /api/dts/enrich

Run a raw webhook through the enrichment pipeline and return the enriched variable map. Used by the DTS editor to get realistic template preview data.

```bash
curl -X POST -H "X-Poracle-Secret: secret" -H "Content-Type: application/json" \
  http://localhost:3030/api/dts/enrich \
  -d '{"type":"pokemon","webhook":{"pokemon_id":129,"latitude":51.28,"longitude":1.08,...},"language":"en"}'
```

```json
{
  "status": "ok",
  "variables": {
    "name": "Magikarp",
    "fullName": "Magikarp",
    "iv": 100,
    "cp": 212,
    "quickMoveName": "Splash",
    ...
  }
}
```

### GET /api/dts/fields/:type

Returns available template fields for a DTS type, with metadata for the editor's tag picker.

Field properties: `name`, `type`, `description`, `category`, `preferred`, `deprecated`, `rawWebhook`, `preferredAlternative`.

```bash
curl -H "X-Poracle-Secret: secret" http://localhost:3030/api/dts/fields/monster
```

```json
{
  "status": "ok",
  "fields": [
    {"name": "fullName", "type": "string", "description": "Name + form", "category": "identity", "preferred": true},
    {"name": "pokemon_id", "type": "int", "description": "Pokemon ID (webhook)", "category": "identity", "rawWebhook": true, "preferredAlternative": "pokemonId"}
  ],
  "blockScopes": [
    {"helper": "each", "iterableFields": ["pvpGreat","pvpUltra","pvpLittle"], "fields": [...]}
  ]
}
```
```

- [ ] **Step 2: Commit**

```bash
git add API.md
git commit -m "docs: add DTS editor API endpoints to API.md"
```

---

## Task 7: GET /api/dts/testdata — Test Webhook Scenarios

**Files:**
- Create: `processor/internal/api/dts_testdata.go`
- Modify: `processor/cmd/processor/main.go` (register route)

Returns the test webhook scenarios from `config/testdata.json`. The DTS editor uses these as raw webhook payloads to send through the enrich endpoint for realistic previews.

- [ ] **Step 1: Create the testdata handler**

Create `processor/internal/api/dts_testdata.go`:

```go
package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// TestDataEntry represents a single test scenario from testdata.json.
type TestDataEntry struct {
	Type     string          `json:"type"`
	Test     string          `json:"test"`
	Location string          `json:"location"`
	Webhook  json.RawMessage `json:"webhook"`
}

// HandleDTSTestdata returns test webhook scenarios for the DTS editor.
// GET /api/dts/testdata?type=pokemon
// Without type filter, returns all scenarios grouped by type.
func HandleDTSTestdata(configDir, fallbackDir string) gin.HandlerFunc {
	return func(c *gin.Context) {
		filterType := c.Query("type")

		// Load testdata.json
		path := filepath.Join(configDir, "testdata.json")
		data, err := os.ReadFile(path)
		if err != nil {
			path = filepath.Join(fallbackDir, "testdata.json")
			data, err = os.ReadFile(path)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "testdata.json not found"})
				return
			}
		}

		var entries []TestDataEntry
		if err := json.Unmarshal(data, &entries); err != nil {
			log.Errorf("dts testdata: parse error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "failed to parse testdata.json"})
			return
		}

		// Filter by type if specified
		if filterType != "" {
			var filtered []TestDataEntry
			for _, e := range entries {
				if e.Type == filterType {
					filtered = append(filtered, e)
				}
			}
			entries = filtered
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok", "testdata": entries})
	}
}
```

- [ ] **Step 2: Register route in main.go**

Inside the `if proc.dtsRenderer != nil` block:

```go
apiGroup.GET("/dts/testdata", api.HandleDTSTestdata(
	filepath.Join(cfg.BaseDir, "config"),
	filepath.Join(cfg.BaseDir, "fallbacks"),
))
```

- [ ] **Step 3: Test the endpoint**

```bash
# List all test scenarios
curl -s -H "X-Poracle-Secret: $SECRET" http://localhost:3030/api/dts/testdata | jq '.testdata | length'

# List pokemon scenarios
curl -s -H "X-Poracle-Secret: $SECRET" "http://localhost:3030/api/dts/testdata?type=pokemon" | jq '.testdata[] | .test'

# Get a specific scenario's webhook
curl -s -H "X-Poracle-Secret: $SECRET" "http://localhost:3030/api/dts/testdata?type=pokemon" | jq '.testdata[] | select(.test=="hundo") | .webhook'
```

- [ ] **Step 4: Commit**

```bash
git add processor/internal/api/dts_testdata.go processor/cmd/processor/main.go
git commit -m "feat: add GET /api/dts/testdata endpoint for test webhook scenarios"
```

---

## Task 8: GET /api/dts/partials — Handlebars Partials

**Files:**
- Create: `processor/internal/api/dts_partials.go` (or add to `dts.go`)
- Modify: `processor/cmd/processor/main.go` (register route)

Returns the Handlebars partials from `config/partials.json`. The DTS editor needs to register these so templates using `{{> partialName}}` render correctly.

- [ ] **Step 1: Add Partials() method to TemplateStore**

The TemplateStore already loads partials in `loadPartials()` and stores them as `ts.partials` (a `map[string]string`). Add a public accessor:

```go
// Partials returns the registered Handlebars partials as a name→template map.
func (ts *TemplateStore) Partials() map[string]string {
	ts.mu.RLock()
	defer ts.mu.RUnlock()
	// Return a copy
	result := make(map[string]string, len(ts.partials))
	for k, v := range ts.partials {
		result[k] = v
	}
	return result
}
```

- [ ] **Step 2: Add handler**

```go
// HandleDTSPartials returns Handlebars partials for the DTS editor.
// GET /api/dts/partials
func HandleDTSPartials(ts *dts.TemplateStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "partials": ts.Partials()})
	}
}
```

- [ ] **Step 3: Register route**

```go
apiGroup.GET("/dts/partials", api.HandleDTSPartials(proc.dtsRenderer.Templates()))
```

- [ ] **Step 4: Test**

```bash
curl -s -H "X-Poracle-Secret: $SECRET" http://localhost:3030/api/dts/partials | jq .
```

Expected: `{"status":"ok","partials":{"remainingTime":"{{#if tthh}}...","otherPartial":"..."}}`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add GET /api/dts/partials endpoint"
```

---

## Task 9: POST /api/dts/sendtest — Send Rendered Test Message

**Files:**
- Create: `processor/internal/api/dts_sendtest.go` (or add to `dts.go`)
- Modify: `processor/cmd/processor/main.go` (register route)

Renders a DTS template with provided variables and delivers the message to a Discord/Telegram user. This lets the DTS editor send the *currently being edited* template with the *currently enriched* data, so the user sees exactly what Discord would render.

- [ ] **Step 1: Create the handler**

```go
// HandleDTSSendTest renders a template with provided variables and delivers to a user.
// POST /api/dts/sendtest
//
// Request body:
//   {
//     "template": {"embed": {"title": "{{name}}", ...}},  // the DTS template object
//     "variables": {"name": "Magikarp", "cp": 212, ...},   // enriched variable map
//     "target": {"id": "123456789", "type": "discord:user"},
//     "language": "en",
//     "platform": "discord"
//   }
//
// The handler:
// 1. JSON-stringifies the template object
// 2. Compiles it as a Handlebars template
// 3. Renders with the provided variables
// 4. Parses the rendered JSON into a message object
// 5. Delivers via the dispatcher (same path as normal alerts)
func HandleDTSSendTest(dispatcher Dispatcher, ts *dts.TemplateStore) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req struct {
            Template  any            `json:"template"`
            Variables map[string]any `json:"variables"`
            Target    struct {
                ID   string `json:"id"`
                Type string `json:"type"`
            } `json:"target"`
            Language string `json:"language"`
            Platform string `json:"platform"`
        }
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
            return
        }

        if req.Target.ID == "" {
            c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "target.id is required"})
            return
        }
        if req.Target.Type == "" {
            req.Target.Type = "discord:user"
        }
        if req.Language == "" {
            req.Language = "en"
        }
        if req.Platform == "" {
            req.Platform = "discord"
        }

        // Stringify template, compile, render with variables
        templateJSON, err := json.Marshal(req.Template)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "invalid template: " + err.Error()})
            return
        }

        compiled, err := raymond.Parse(string(templateJSON))
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "template compile error: " + err.Error()})
            return
        }

        // Register partials
        partials := ts.Partials()
        if len(partials) > 0 {
            compiled.RegisterPartials(partials)
        }

        df := raymond.NewDataFrame()
        df.Set("language", req.Language)
        df.Set("platform", req.Platform)

        rendered, err := compiled.ExecWith(req.Variables, df)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "render error: " + err.Error()})
            return
        }

        // Parse rendered JSON into message
        var message any
        if err := json.Unmarshal([]byte(rendered), &message); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "rendered template is not valid JSON: " + err.Error()})
            return
        }

        // Deliver via dispatcher (same as postMessage)
        // Construct a delivery job and send it
        // ... (use the same delivery mechanism as HandleDeliverMessages)

        c.JSON(http.StatusOK, gin.H{"status": "ok", "message": "sent"})
    }
}
```

**Note for implementing agent:** The delivery mechanism depends on the existing dispatcher interface. Look at how `HandleDeliverMessages` / `HandlePostMessage` works in the codebase — it accepts a message object and a target (id + type), and sends via Discord REST API or Telegram Bot API. Reuse that same delivery path. The key difference from `POST /api/test` is that here we provide the template and variables directly rather than going through the enrichment pipeline.

- [ ] **Step 2: Register route**

```go
apiGroup.POST("/dts/sendtest", api.HandleDTSSendTest(proc.dispatcher, proc.dtsRenderer.Templates()))
```

- [ ] **Step 3: Test**

```bash
curl -s -X POST -H "X-Poracle-Secret: $SECRET" -H "Content-Type: application/json" \
  http://localhost:3030/api/dts/sendtest \
  -d '{
    "template": {"embed": {"title": "Test: {{name}}", "description": "CP: {{cp}}"}},
    "variables": {"name": "Magikarp", "cp": 212},
    "target": {"id": "YOUR_DISCORD_ID", "type": "discord:user"}
  }'
```

Expected: User receives a Discord DM with the rendered embed.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add POST /api/dts/sendtest for sending test messages from editor"
```

---

## Summary

| Task | Endpoint | Purpose |
|------|----------|---------|
| 1 | CORS middleware | Allow cross-origin requests from editor |
| 2 | `GET /api/dts/templates` | Return template content (Handlebars JSON) |
| 3 | `POST /api/dts/templates` | Save template changes to dts.json |
| 4 | `POST /api/dts/enrich` | Enrich webhook → return variable map |
| 5 | `GET /api/dts/fields/:type` | Field metadata for tag picker |
| 6 | Update API.md | Document new endpoints |
| 7 | `GET /api/dts/testdata` | Test webhook scenarios from testdata.json |
| 8 | `GET /api/dts/partials` | Handlebars partials for template rendering |
| 9 | `POST /api/dts/sendtest` | Render + deliver test message to a user |

**Important notes for the implementing agent:**
- Check the actual method signatures in `processor/internal/enrichment/*.go` — the `Enrich*` methods may have different signatures than shown. Look at `test.go` for the real call pattern.
- The webhook type structs are in `processor/internal/webhook/` — verify exact type names.
- The `EnrichWebhook` method in Task 4 is the most complex — it needs to match the exact enrichment call pattern used in the test handlers. Copy the approach from the existing `processTestPokemon` etc. in `test.go`.
- The field definitions in Task 5 should be completed for all types listed in `DTS.md`. The plan shows monster, raid, egg, quest, and invasion — add lure, nest, gym, fort-update, weatherchange, and greeting following the same pattern.
