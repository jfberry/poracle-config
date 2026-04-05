/**
 * Field definitions for the DTS tag picker.
 * Derived from PoracleNG DTS.md documentation.
 *
 * Each field: { name, type, description, category, preferred, deprecated, rawWebhook, preferredAlternative }
 */

function field(name, type, description, category, opts = {}) {
  return {
    name,
    type,
    description,
    category,
    preferred: opts.preferred || false,
    deprecated: opts.deprecated || false,
    rawWebhook: opts.rawWebhook || false,
    preferredAlternative: opts.preferredAlternative || null,
  };
}

// ─── Common fields (shared across all types) ───

const commonFields = [
  field('latitude', 'number', 'Latitude coordinate', 'location'),
  field('longitude', 'number', 'Longitude coordinate', 'location'),
  field('addr', 'string', 'Full address from geocoding', 'location'),
  field('streetName', 'string', 'Street name', 'location'),
  field('city', 'string', 'City name', 'location'),
  field('country', 'string', 'Country name', 'location'),
  field('flag', 'string', 'Country flag emoji', 'location'),
  field('areas', 'string', 'Matched geofence area names', 'location'),
  field('staticMap', 'string', 'Static map image URL', 'map', { preferred: true }),
  field('staticmap', 'string', 'Static map image URL (deprecated)', 'map', { deprecated: true, preferredAlternative: 'staticMap' }),
  field('imgUrl', 'string', 'Icon image URL', 'media', { preferred: true }),
  field('googleMapUrl', 'string', 'Google Maps link', 'map', { preferred: true }),
  field('appleMapUrl', 'string', 'Apple Maps link', 'map', { preferred: true }),
  field('wazeMapUrl', 'string', 'Waze navigation link', 'map'),
  field('mapurl', 'string', 'Google Maps link (deprecated)', 'map', { deprecated: true, preferredAlternative: 'googleMapUrl' }),
  field('applemap', 'string', 'Apple Maps link (deprecated)', 'map', { deprecated: true, preferredAlternative: 'appleMapUrl' }),
  field('tthd', 'number', 'Time to hide — days', 'time'),
  field('tthh', 'number', 'Time to hide — hours', 'time'),
  field('tthm', 'number', 'Time to hide — minutes', 'time'),
  field('tths', 'number', 'Time to hide — seconds', 'time'),
  field('now', 'string', 'Current timestamp', 'time'),
  field('distance', 'string', 'Distance from user', 'location'),
  field('bearing', 'string', 'Compass bearing from user', 'location'),
  field('bearingEmoji', 'string', 'Compass bearing as emoji arrow', 'location'),
];

// ─── Monster fields ───

const monsterFields = [
  ...commonFields,
  field('name', 'string', 'Pokemon name', 'pokemon', { preferred: true }),
  field('fullName', 'string', 'Pokemon name with form', 'pokemon', { preferred: true }),
  field('formName', 'string', 'Form name', 'pokemon', { preferred: true }),
  field('pokemonId', 'number', 'Pokemon ID number', 'pokemon', { preferred: true }),
  field('pokemon_id', 'number', 'Pokemon ID (raw webhook)', 'pokemon', { rawWebhook: true, preferredAlternative: 'pokemonId' }),
  field('formId', 'number', 'Form ID number', 'pokemon', { preferred: true }),
  field('nameEng', 'string', 'Pokemon name in English', 'pokemon'),
  field('fullNameEng', 'string', 'Full pokemon name in English', 'pokemon'),
  field('iv', 'number', 'IV percentage (0-100)', 'stats', { preferred: true }),
  field('atk', 'number', 'Attack IV (0-15)', 'stats', { preferred: true }),
  field('def', 'number', 'Defense IV (0-15)', 'stats', { preferred: true }),
  field('sta', 'number', 'Stamina IV (0-15)', 'stats', { preferred: true }),
  field('cp', 'number', 'Combat Power', 'stats', { preferred: true }),
  field('level', 'number', 'Pokemon level', 'stats', { preferred: true }),
  field('ivColor', 'string', 'Color hex based on IV percentage', 'display', { preferred: true }),
  field('weight', 'number', 'Pokemon weight in kg', 'stats'),
  field('height', 'number', 'Pokemon height in m', 'stats'),
  field('individual_attack', 'number', 'Attack IV (deprecated)', 'stats', { deprecated: true, preferredAlternative: 'atk' }),
  field('individual_defense', 'number', 'Defense IV (deprecated)', 'stats', { deprecated: true, preferredAlternative: 'def' }),
  field('individual_stamina', 'number', 'Stamina IV (deprecated)', 'stats', { deprecated: true, preferredAlternative: 'sta' }),
  field('quickMoveName', 'string', 'Quick move name', 'moves', { preferred: true }),
  field('chargeMoveName', 'string', 'Charge move name', 'moves', { preferred: true }),
  field('quickMoveEmoji', 'string', 'Quick move type emoji', 'moves'),
  field('chargeMoveEmoji', 'string', 'Charge move type emoji', 'moves'),
  field('quickMoveId', 'number', 'Quick move ID', 'moves'),
  field('chargeMoveId', 'number', 'Charge move ID', 'moves'),
  field('move_1', 'number', 'Quick move ID (deprecated)', 'moves', { deprecated: true, preferredAlternative: 'quickMoveId' }),
  field('move_2', 'number', 'Charge move ID (deprecated)', 'moves', { deprecated: true, preferredAlternative: 'chargeMoveId' }),
  field('time', 'string', 'Despawn time formatted', 'time', { preferred: true }),
  field('disappearTime', 'string', 'Despawn time (full format)', 'time'),
  field('confirmedTime', 'string', 'Whether despawn time is confirmed', 'time'),
  field('distime', 'string', 'Despawn time (deprecated)', 'time', { deprecated: true, preferredAlternative: 'disappearTime' }),
  field('boostWeatherEmoji', 'string', 'Weather boost emoji', 'weather', { preferred: true }),
  field('boostWeatherName', 'string', 'Weather boost name', 'weather'),
  field('boosted', 'boolean', 'Whether pokemon is weather boosted', 'weather'),
  field('weatherChange', 'boolean', 'Whether weather is changing', 'weather'),
  field('pvpGreat', 'array', 'PvP Great League rankings', 'pvp', { preferred: true }),
  field('pvpUltra', 'array', 'PvP Ultra League rankings', 'pvp', { preferred: true }),
  field('pvpLittle', 'array', 'PvP Little League rankings', 'pvp'),
  field('generation', 'number', 'Pokemon generation', 'pokemon'),
  field('genderData', 'object', 'Gender info with name and emoji', 'pokemon'),
  field('shinyPossible', 'boolean', 'Whether shiny form exists', 'pokemon'),
  field('color', 'string', 'Pokemon type color hex', 'display'),
  field('encountered', 'boolean', 'Whether IV data is available', 'stats'),
];

const monsterNoIvFields = monsterFields.filter(
  (f) => !['iv', 'atk', 'def', 'sta', 'cp', 'level', 'ivColor', 'weight', 'height',
    'individual_attack', 'individual_defense', 'individual_stamina',
    'quickMoveName', 'chargeMoveName', 'quickMoveEmoji', 'chargeMoveEmoji',
    'quickMoveId', 'chargeMoveId', 'move_1', 'move_2',
    'pvpGreat', 'pvpUltra', 'pvpLittle'].includes(f.name)
);

// ─── Raid fields ───

const raidFields = [
  ...commonFields,
  field('name', 'string', 'Raid boss name', 'pokemon', { preferred: true }),
  field('fullName', 'string', 'Raid boss full name with form', 'pokemon'),
  field('level', 'number', 'Raid tier level', 'raid', { preferred: true }),
  field('levelName', 'string', 'Raid tier name (e.g. Mega, Legendary)', 'raid'),
  field('gymName', 'string', 'Gym name', 'gym', { preferred: true }),
  field('gym_name', 'string', 'Gym name (raw webhook)', 'gym', { rawWebhook: true, preferredAlternative: 'gymName' }),
  field('gymColor', 'string', 'Gym team color hex', 'gym'),
  field('ex', 'boolean', 'Whether gym is EX eligible', 'gym'),
  field('time', 'string', 'Raid end time formatted', 'time', { preferred: true }),
  field('cp', 'number', 'Raid boss CP', 'stats', { preferred: true }),
  field('quickMoveName', 'string', 'Quick move name', 'moves', { preferred: true }),
  field('chargeMoveName', 'string', 'Charge move name', 'moves', { preferred: true }),
];

// ─── Egg fields ───

const eggFields = [
  ...commonFields,
  field('level', 'number', 'Egg tier level', 'raid', { preferred: true }),
  field('levelName', 'string', 'Egg tier name', 'raid'),
  field('gymName', 'string', 'Gym name', 'gym', { preferred: true }),
  field('gymColor', 'string', 'Gym team color hex', 'gym'),
  field('ex', 'boolean', 'Whether gym is EX eligible', 'gym'),
  field('time', 'string', 'Egg hatch time formatted', 'time', { preferred: true }),
];

// ─── Quest fields ───

const questFields = [
  ...commonFields,
  field('pokestopName', 'string', 'Pokestop name', 'pokestop', { preferred: true }),
  field('questString', 'string', 'Quest task description', 'quest', { preferred: true }),
  field('rewardString', 'string', 'Quest reward description', 'quest', { preferred: true }),
];

// ─── Invasion fields ───

const invasionFields = [
  ...commonFields,
  field('pokestopName', 'string', 'Pokestop name', 'pokestop', { preferred: true }),
  field('gruntType', 'string', 'Grunt type description', 'invasion', { preferred: true }),
  field('gruntTypeEmoji', 'string', 'Grunt type emoji', 'invasion'),
  field('gruntTypeColor', 'string', 'Grunt type color hex', 'invasion'),
  field('genderData', 'object', 'Grunt gender info', 'invasion'),
  field('gruntRewardsList', 'array', 'Possible shadow pokemon rewards', 'invasion'),
  field('time', 'string', 'Invasion end time formatted', 'time', { preferred: true }),
];

// ─── Lure fields ───

const lureFields = [
  ...commonFields,
  field('pokestopName', 'string', 'Pokestop name', 'pokestop', { preferred: true }),
  field('lureTypeName', 'string', 'Lure type name', 'lure', { preferred: true }),
  field('lureTypeColor', 'string', 'Lure type color hex', 'lure'),
  field('time', 'string', 'Lure end time formatted', 'time', { preferred: true }),
];

// ─── Nest fields ───

const nestFields = [
  ...commonFields,
  field('name', 'string', 'Nesting pokemon name', 'pokemon', { preferred: true }),
  field('nestName', 'string', 'Nest/park name', 'nest', { preferred: true }),
  field('pokemonSpawnAvg', 'number', 'Average spawns per hour', 'nest', { preferred: true }),
  field('resetDate', 'string', 'Last nest migration date', 'nest'),
  field('color', 'string', 'Pokemon type color hex', 'display'),
];

// ─── Gym fields ───

const gymFields = [
  ...commonFields,
  field('gymName', 'string', 'Gym name', 'gym', { preferred: true }),
  field('teamName', 'string', 'Controlling team name', 'gym', { preferred: true }),
  field('previousControlName', 'string', 'Previous controlling team', 'gym'),
  field('slotsAvailable', 'number', 'Open slots in gym', 'gym'),
  field('color', 'string', 'Team color hex', 'display'),
];

// ─── Exported map ───

export const fieldsByType = {
  monster: monsterFields,
  monsterNoIv: monsterNoIvFields,
  raid: raidFields,
  egg: eggFields,
  quest: questFields,
  invasion: invasionFields,
  lure: lureFields,
  nest: nestFields,
  gym: gymFields,
};

// ─── Block scope definitions ───

const pvpScope = [
  field('rank', 'number', 'PvP rank', 'pvp'),
  field('cp', 'number', 'CP at best IV spread', 'pvp'),
  field('fullName', 'string', 'Pokemon name (may be evolution)', 'pvp'),
  field('level', 'number', 'Level at best IV spread', 'pvp'),
  field('levelWithCap', 'string', 'Level with cap notation', 'pvp'),
  field('percentage', 'number', 'Stat product percentage', 'pvp'),
  field('cap', 'number', 'Level cap used for calculation', 'pvp'),
];

export const blockScopes = {
  pvpGreat: pvpScope,
  pvpUltra: pvpScope,
  pvpLittle: pvpScope,
  pokemon: [
    field('name', 'string', 'Pokemon name', 'pokemon'),
    field('nameEng', 'string', 'Pokemon name in English', 'pokemon'),
    field('fullName', 'string', 'Full name with form', 'pokemon'),
    field('formName', 'string', 'Form name', 'pokemon'),
    field('typeName', 'array', 'Type names', 'pokemon'),
    field('typeEmoji', 'array', 'Type emojis', 'pokemon'),
    field('baseStats', 'object', 'Base stats (baseAttack, baseDefense, baseStamina)', 'pokemon'),
    field('hasEvolutions', 'boolean', 'Whether pokemon has evolutions', 'pokemon'),
  ],
  getPowerUpCost: [
    field('stardust', 'number', 'Stardust cost', 'cost'),
    field('candy', 'number', 'Candy cost', 'cost'),
    field('xlCandy', 'number', 'XL Candy cost', 'cost'),
  ],
};

// ─── Accessor functions ───

export function getFieldsForType(type) {
  return fieldsByType[type] || [];
}

export function getBlockScope(fieldName) {
  return blockScopes[fieldName] || null;
}
