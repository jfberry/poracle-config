/**
 * Pre-enriched variable maps for standalone preview mode.
 * Each scenario provides realistic values for all common + type-specific fields.
 */

const now = new Date();
const despawnTime = new Date(now.getTime() + 25 * 60 * 1000);
const raidEndTime = new Date(now.getTime() + 42 * 60 * 1000);
const eggHatchTime = new Date(now.getTime() + 18 * 60 * 1000);
const invasionEndTime = new Date(now.getTime() + 27 * 60 * 1000);

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function commonLocation() {
  return {
    latitude: 51.5074,
    longitude: -0.1278,
    addr: '10 Downing Street, London SW1A 2AA, UK',
    streetName: 'Downing Street',
    city: 'London',
    country: 'United Kingdom',
    flag: '\u{1F1EC}\u{1F1E7}',
    areas: 'Westminster, Central London',
    staticMap: 'https://pokemon.pokemon.pokemon/staticmap/monster_51.5074_-0.1278.png',
    staticmap: 'https://pokemon.pokemon.pokemon/staticmap/monster_51.5074_-0.1278.png',
    googleMapUrl: 'https://www.google.com/maps/search/?api=1&query=51.5074,-0.1278',
    appleMapUrl: 'https://maps.apple.com/?ll=51.5074,-0.1278',
    wazeMapUrl: 'https://www.waze.com/ul?ll=51.5074,-0.1278&navigate=yes',
    mapurl: 'https://www.google.com/maps/search/?api=1&query=51.5074,-0.1278',
    applemap: 'https://maps.apple.com/?ll=51.5074,-0.1278',
    tthd: 0,
    tthh: 0,
    tthm: 25,
    tths: 14,
    now: formatTime(now),
    distance: '1.2km',
    bearing: 'NW',
    bearingEmoji: '\u2196\uFE0F',
  };
}

export const testScenarios = {
  monster: {
    hundo: {
      ...commonLocation(),
      name: 'Magikarp',
      fullName: 'Magikarp',
      formName: 'Normal',
      pokemonId: 129,
      pokemon_id: 129,
      formId: 0,
      nameEng: 'Magikarp',
      fullNameEng: 'Magikarp',
      iv: 100,
      atk: 15,
      def: 15,
      sta: 15,
      cp: 203,
      level: 35,
      ivColor: '#00ff00',
      weight: 10.2,
      height: 0.92,
      individual_attack: 15,
      individual_defense: 15,
      individual_stamina: 15,
      quickMoveName: 'Splash',
      chargeMoveName: 'Struggle',
      quickMoveEmoji: '\u{1F4A7}',
      chargeMoveEmoji: '\u26AA',
      quickMoveId: 227,
      chargeMoveId: 79,
      move_1: 227,
      move_2: 79,
      time: formatTime(despawnTime),
      disappearTime: despawnTime.toLocaleString(),
      confirmedTime: 'Yes',
      distime: formatTime(despawnTime),
      boostWeatherEmoji: '\u{1F327}\uFE0F',
      boostWeatherName: 'Rainy',
      boosted: true,
      weatherChange: false,
      pvpGreat: [
        { rank: 1, cp: 1496, fullName: 'Gyarados', level: 18.5, levelWithCap: '18.5/50', percentage: 99.8, cap: 50 },
        { rank: 4, cp: 1491, fullName: 'Gyarados (Shadow)', level: 18, levelWithCap: '18/50', percentage: 98.2, cap: 50 },
      ],
      pvpUltra: [
        { rank: 2, cp: 2498, fullName: 'Gyarados', level: 27, levelWithCap: '27/50', percentage: 99.1, cap: 50 },
      ],
      pvpLittle: [
        { rank: 1, cp: 497, fullName: 'Magikarp', level: 29, levelWithCap: '29/51', percentage: 100, cap: 51 },
      ],
      generation: 1,
      genderData: { name: 'Male', emoji: '\u2642\uFE0F' },
      shinyPossible: true,
      color: '#6890F0',
      encountered: true,
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/pokemon/129.png',
    },
    boring: {
      ...commonLocation(),
      name: 'Barboach',
      fullName: 'Barboach',
      formName: 'Normal',
      pokemonId: 339,
      pokemon_id: 339,
      formId: 0,
      nameEng: 'Barboach',
      fullNameEng: 'Barboach',
      iv: 22.2,
      atk: 2,
      def: 5,
      sta: 3,
      cp: 118,
      level: 14,
      ivColor: '#ff0000',
      weight: 1.8,
      height: 0.38,
      individual_attack: 2,
      individual_defense: 5,
      individual_stamina: 3,
      quickMoveName: 'Mud Shot',
      chargeMoveName: 'Aqua Tail',
      quickMoveEmoji: '\u{1F7E4}',
      chargeMoveEmoji: '\u{1F4A7}',
      quickMoveId: 207,
      chargeMoveId: 49,
      move_1: 207,
      move_2: 49,
      time: formatTime(despawnTime),
      disappearTime: despawnTime.toLocaleString(),
      confirmedTime: 'Yes',
      distime: formatTime(despawnTime),
      boostWeatherEmoji: '',
      boostWeatherName: '',
      boosted: false,
      weatherChange: false,
      pvpGreat: [],
      pvpUltra: [],
      pvpLittle: [],
      generation: 3,
      genderData: { name: 'Female', emoji: '\u2640\uFE0F' },
      shinyPossible: false,
      color: '#E0C068',
      encountered: true,
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/pokemon/339.png',
    },
  },

  raid: {
    level5: {
      ...commonLocation(),
      name: 'Heatran',
      fullName: 'Heatran',
      level: 5,
      levelName: 'Legendary',
      gymName: 'Big Ben Clock Tower',
      gym_name: 'Big Ben Clock Tower',
      gymColor: '#FF9C00',
      ex: false,
      time: formatTime(raidEndTime),
      cp: 41546,
      quickMoveName: 'Fire Spin',
      chargeMoveName: 'Iron Head',
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/pokemon/485.png',
    },
    egg1: {
      ...commonLocation(),
      level: 1,
      levelName: 'Normal',
      gymName: 'St Paul\'s Cathedral',
      gym_name: 'St Paul\'s Cathedral',
      gymColor: '#0000FF',
      ex: true,
      time: formatTime(eggHatchTime),
      cp: 0,
      name: '',
      fullName: '',
      quickMoveName: '',
      chargeMoveName: '',
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/raid/egg_1.png',
    },
  },

  egg: {
    level5: {
      ...commonLocation(),
      level: 5,
      levelName: 'Legendary',
      gymName: 'Tower of London',
      gym_name: 'Tower of London',
      gymColor: '#FF9C00',
      ex: false,
      time: formatTime(eggHatchTime),
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/raid/egg_5.png',
    },
  },

  quest: {
    basic: {
      ...commonLocation(),
      pokestopName: 'The Red Lion Pub',
      questString: 'Catch 5 Pokemon',
      rewardString: '1500 Stardust',
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/reward/stardust/1500.png',
    },
  },

  invasion: {
    basic: {
      ...commonLocation(),
      pokestopName: 'Westminster Abbey Fountain',
      gruntType: 'Bug',
      gruntTypeEmoji: '\u{1F41B}',
      gruntTypeColor: '#A8B820',
      genderData: { name: 'Female', emoji: '\u2640\uFE0F' },
      gruntRewardsList: {
        first: { pokemon: [{ name: 'Weedle', id: 13 }, { name: 'Caterpie', id: 10 }] },
        second: { pokemon: [{ name: 'Scizor', id: 212 }] },
      },
      time: formatTime(invasionEndTime),
      imgUrl: 'https://raw.githubusercontent.com/nileplumb/PkmnHomeIcons/master/UICON/invasion/bug_female.png',
    },
  },
};

/**
 * Get a specific test scenario by type and scenario name.
 * @param {string} type - DTS type (monster, raid, etc.)
 * @param {string} scenario - Scenario name (hundo, boring, etc.)
 * @returns {object|null} Variable map or null
 */
export function getTestScenario(type, scenario) {
  return testScenarios[type]?.[scenario] || null;
}

/**
 * Get available scenario names for a type.
 * @param {string} type - DTS type
 * @returns {string[]} Array of scenario names
 */
export function getTestScenarioNames(type) {
  return Object.keys(testScenarios[type] || {});
}
