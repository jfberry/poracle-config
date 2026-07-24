import { describe, it, expect } from 'vitest';
import { createEngine } from '../handlebars-engine';
import { renderButtonResponse } from '../render-button-response';

const engine = createEngine();

describe('renderButtonResponse — action dispatches', () => {
  it('returns an info chip for redeliver', () => {
    const r = renderButtonResponse(engine, { id: 'a', action: 'redeliver' }, [], {}, 'discord');
    expect(r).toEqual({ kind: 'action', label: 'Action: redeliver' });
  });
  it('includes scope and params', () => {
    const r = renderButtonResponse(engine, {
      id: 'b', action: 'mute', scope: 'pokemon', params: { duration_min: 60 },
    }, [], {}, 'discord');
    expect(r.label).toBe('Action: mute · scope: pokemon · params: duration_min=60');
  });
});

describe('renderButtonResponse — response_text', () => {
  it('renders Handlebars and returns content', () => {
    const r = renderButtonResponse(engine, {
      id: 'c', response_text: '📍 {{name}}',
    }, [], { name: 'X' }, 'discord');
    expect(r).toEqual({ kind: 'message', data: { content: '📍 X' } });
  });
});

describe('renderButtonResponse — response_template_inline', () => {
  it('renders object leaves', () => {
    const r = renderButtonResponse(engine, {
      id: 'd', response_template_inline: { embed: { title: 'Hi {{name}}', color: '#fff' } },
    }, [], { name: 'X' }, 'discord');
    expect(r).toEqual({ kind: 'message', data: { embed: { title: 'Hi X', color: '#fff' } } });
  });
  it('renders string then JSON-parses', () => {
    const r = renderButtonResponse(engine, {
      id: 'e', response_template_inline: '{ "content": "{{name}}" }',
    }, [], { name: 'Y' }, 'discord');
    expect(r).toEqual({ kind: 'message', data: { content: 'Y' } });
  });
  it('falls back to plain content when rendered string is not JSON', () => {
    const r = renderButtonResponse(engine, {
      id: 'f', response_template_inline: 'hi {{name}}',
    }, [], { name: 'Z' }, 'discord');
    expect(r).toEqual({ kind: 'message', data: { content: 'hi Z' } });
  });
});

describe('renderButtonResponse — response_template_id', () => {
  it('finds and renders a linked buttonResponse entry', () => {
    const templates = [
      { type: 'buttonResponse', id: 'rsvp', platform: 'discord', language: 'en',
        template: { embed: { title: 'RSVP for {{name}}' } } },
    ];
    const r = renderButtonResponse(engine, {
      id: 'g', response_template_id: 'rsvp',
    }, templates, { name: 'X' }, 'discord');
    expect(r).toEqual({ kind: 'message', data: { embed: { title: 'RSVP for X' } } });
  });
  it('returns an error kind when no matching entry exists', () => {
    const r = renderButtonResponse(engine, {
      id: 'h', response_template_id: 'missing',
    }, [], {}, 'discord');
    expect(r.kind).toBe('error');
    expect(r.message).toContain('missing');
  });
});

describe('renderButtonResponse — null / missing', () => {
  it('returns null when no dispatch field is set', () => {
    expect(renderButtonResponse(engine, { id: 'i' }, [], {}, 'discord')).toBe(null);
  });
  it('returns null when button is null', () => {
    expect(renderButtonResponse(engine, null, [], {}, 'discord')).toBe(null);
  });
});
