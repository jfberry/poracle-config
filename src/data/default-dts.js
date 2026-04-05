/**
 * Default DTS templates for Discord platform.
 * Based on the actual Poracle default templates.
 */

export const defaultTemplates = [
  {
    id: 'default-monster',
    type: 'monster',
    platform: 'discord',
    language: 'en',
    default: true,
    template: {
      embed: {
        color: '{{ivColor}}',
        title: '{{round iv}}% {{fullName}} cp:{{cp}} L:{{level}} {{atk}}/{{def}}/{{sta}} {{{boostWeatherEmoji}}}',
        description: [
          'Despawns at: {{time}} ({{tthm}}m {{tths}}s)',
          '{{addr}}',
          '',
          'Quick: {{quickMoveName}} {{{quickMoveEmoji}}}',
          'Charge: {{chargeMoveName}} {{{chargeMoveEmoji}}}',
          '',
          '{{#if pvpGreat}}**Great League:**',
          '{{#each pvpGreat}}#{{rank}} {{fullName}} {{cp}}cp L{{level}} {{percentage}}%{{#unless isLast}}, {{/unless}}{{/each}}{{/if}}',
          '{{#if pvpUltra}}**Ultra League:**',
          '{{#each pvpUltra}}#{{rank}} {{fullName}} {{cp}}cp L{{level}} {{percentage}}%{{#unless isLast}}, {{/unless}}{{/each}}{{/if}}',
        ].join('\n'),
        thumbnail: {
          url: '{{{imgUrl}}}',
        },
        image: {
          url: '{{{staticMap}}}',
        },
      },
    },
  },
  {
    id: 'default-raid',
    type: 'raid',
    platform: 'discord',
    language: 'en',
    default: true,
    template: {
      embed: {
        color: '{{gymColor}}',
        author: {
          name: 'Ends: {{time}}',
        },
        title: 'Level {{level}} {{name}} raid at {{{gymName}}}{{#if ex}} \u{1F3AB}{{/if}}',
        description: [
          'CP: {{cp}}',
          'Quick: {{quickMoveName}}',
          'Charge: {{chargeMoveName}}',
          '',
          '{{addr}}',
          '[Google Maps]({{{googleMapUrl}}}) | [Apple Maps]({{{appleMapUrl}}})',
        ].join('\n'),
        thumbnail: {
          url: '{{{imgUrl}}}',
        },
        image: {
          url: '{{{staticMap}}}',
        },
      },
    },
  },
  {
    id: 'default-egg',
    type: 'egg',
    platform: 'discord',
    language: 'en',
    default: true,
    template: {
      embed: {
        color: '{{gymColor}}',
        author: {
          name: 'Hatches: {{time}}',
        },
        title: 'Level {{level}} egg at {{{gymName}}}{{#if ex}} \u{1F3AB}{{/if}}',
        description: [
          '{{addr}}',
          '[Google Maps]({{{googleMapUrl}}}) | [Apple Maps]({{{appleMapUrl}}})',
        ].join('\n'),
        thumbnail: {
          url: '{{{imgUrl}}}',
        },
        image: {
          url: '{{{staticMap}}}',
        },
      },
    },
  },
  {
    id: 'default-quest',
    type: 'quest',
    platform: 'discord',
    language: 'en',
    default: true,
    template: {
      embed: {
        title: '{{{pokestopName}}}',
        url: '{{{googleMapUrl}}}',
        description: [
          '**Quest:** {{questString}}',
          '**Reward:** {{rewardString}}',
          '',
          '{{addr}}',
          '[Google Maps]({{{googleMapUrl}}}) | [Apple Maps]({{{appleMapUrl}}})',
        ].join('\n'),
        thumbnail: {
          url: '{{{imgUrl}}}',
        },
        image: {
          url: '{{{staticMap}}}',
        },
      },
    },
  },
  {
    id: 'default-invasion',
    type: 'invasion',
    platform: 'discord',
    language: 'en',
    default: true,
    template: {
      embed: {
        color: '{{gruntTypeColor}}',
        title: '{{{gruntTypeEmoji}}} Team Rocket at {{{pokestopName}}}',
        description: [
          '**Type:** {{gruntType}} {{{gruntTypeEmoji}}}',
          '**Gender:** {{genderData.name}} {{{genderData.emoji}}}',
          '**Ends:** {{time}}',
          '',
          '{{addr}}',
          '[Google Maps]({{{googleMapUrl}}}) | [Apple Maps]({{{appleMapUrl}}})',
        ].join('\n'),
        thumbnail: {
          url: '{{{imgUrl}}}',
        },
        image: {
          url: '{{{staticMap}}}',
        },
      },
    },
  },
];

/**
 * Find a specific template.
 * @param {string} type - DTS type
 * @param {string} [platform='discord'] - Platform
 * @param {string} [language='en'] - Language
 * @param {string} [id] - Template id
 * @returns {object|undefined}
 */
export function getDefaultTemplate(type, platform = 'discord', language = 'en', id) {
  return defaultTemplates.find((t) => {
    if (id && t.id !== id) return false;
    return t.type === type && t.platform === platform && t.language === language;
  });
}

/**
 * Get unique types that have default templates.
 * @returns {string[]}
 */
export function getAvailableTypes() {
  return [...new Set(defaultTemplates.map((t) => t.type))];
}
