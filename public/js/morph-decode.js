/**
 * OSHB Morphology Code Decoder
 * Decodes Open Scriptures Hebrew Bible morphology codes into human-readable descriptions
 * @module js/morph-decode
 */

(function () {
  'use strict';

  const POS = {
    A: 'Adjective', C: 'Conjunction', D: 'Adverb', N: 'Noun',
    P: 'Pronoun', R: 'Preposition', S: 'Suffix', T: 'Particle', V: 'Verb',
  };

  const VERB_STEM = {
    q: 'Qal', N: 'Niphal', p: 'Piel', P: 'Pual', h: 'Hiphil',
    H: 'Hophal', t: 'Hithpael', o: 'Polel', O: 'Polal', r: 'Hithpolel',
    m: 'Poel', M: 'Poal', k: 'Palel', K: 'Pulal', Q: 'Qal Passive',
    l: 'Pilpel', L: 'Polpal', f: 'Hithpalpel', D: 'Nithpael',
    j: 'Pealal', i: 'Pilel', u: 'Hothpaal', c: 'Tiphil',
    v: 'Hishtaphel', w: 'Nithpalel', y: 'Nithpoel', z: 'Hithpoel',
  };

  const VERB_TYPE = {
    p: 'Perfect', q: 'Sequential Perfect', i: 'Imperfect', w: 'Sequential Imperfect',
    v: 'Imperative', r: 'Participle Active', s: 'Participle Passive',
    a: 'Infinitive Absolute', c: 'Infinitive Construct',
    h: 'Cohortative', j: 'Jussive',
  };

  const NOUN_TYPE = { c: 'Common', p: 'Proper' };

  const PERSON = { 1: '1st Person', 2: '2nd Person', 3: '3rd Person', x: '' };

  const GENDER = {
    m: 'Masculine', f: 'Feminine', b: 'Both', c: 'Common', x: '',
  };

  const NUMBER = {
    s: 'Singular', p: 'Plural', d: 'Dual', x: '',
  };

  const STATE = {
    a: 'Absolute', c: 'Construct', d: 'Determined',
  };

  const PARTICLE_TYPE = {
    d: 'Definite Article', a: 'Accusative', e: 'Exhortation',
    i: 'Interrogative', j: 'Interjection', m: 'Demonstrative',
    n: 'Negative', o: 'Direct Object', r: 'Relative',
  };

  const PRONOUN_TYPE = {
    d: 'Demonstrative', f: 'Indefinite', i: 'Interrogative',
    p: 'Personal', r: 'Relative', x: '',
  };

  /**
   * Decodes a single morphology segment (no slashes)
   * @param {string} code - Single morph code segment
   * @returns {string} Human-readable description
   */
  function decodeSegment(code) {
    if (!code || code.length === 0) return '';

    const pos = POS[code[0]];
    if (!pos) return code;
    const parts = [pos];
    const rest = code.slice(1);

    switch (code[0]) {
      case 'V': {
        if (rest[0]) parts.push(VERB_STEM[rest[0]] || rest[0]);
        if (rest[1]) parts.push(VERB_TYPE[rest[1]] || rest[1]);
        // Participles and infinitives: gender, number, state (no person)
        if (rest[1] === 'r' || rest[1] === 's' || rest[1] === 'a' || rest[1] === 'c') {
          if (rest[2]) parts.push(GENDER[rest[2]] || '');
          if (rest[3]) parts.push(NUMBER[rest[3]] || '');
          if (rest[4]) parts.push(STATE[rest[4]] || '');
        } else {
          if (rest[2]) parts.push(PERSON[rest[2]] || '');
          if (rest[3]) parts.push(GENDER[rest[3]] || '');
          if (rest[4]) parts.push(NUMBER[rest[4]] || '');
        }
        break;
      }
      case 'N': {
        if (rest[0]) parts.push(NOUN_TYPE[rest[0]] || rest[0]);
        if (rest[1]) parts.push(GENDER[rest[1]] || '');
        if (rest[2]) parts.push(NUMBER[rest[2]] || '');
        if (rest[3]) parts.push(STATE[rest[3]] || '');
        break;
      }
      case 'A': {
        // Adjective: type, gender, number, state
        if (rest[0]) parts.push(NOUN_TYPE[rest[0]] || rest[0]);
        if (rest[1]) parts.push(GENDER[rest[1]] || '');
        if (rest[2]) parts.push(NUMBER[rest[2]] || '');
        if (rest[3]) parts.push(STATE[rest[3]] || '');
        break;
      }
      case 'T': {
        if (rest[0]) parts.push(PARTICLE_TYPE[rest[0]] || rest[0]);
        break;
      }
      case 'P': {
        if (rest[0]) parts.push(PRONOUN_TYPE[rest[0]] || rest[0]);
        if (rest[1]) parts.push(PERSON[rest[1]] || '');
        if (rest[2]) parts.push(GENDER[rest[2]] || '');
        if (rest[3]) parts.push(NUMBER[rest[3]] || '');
        break;
      }
      case 'S': {
        // Suffix: pronoun-like
        if (rest[0]) parts.push(PRONOUN_TYPE[rest[0]] || rest[0]);
        if (rest[1]) parts.push(PERSON[rest[1]] || '');
        if (rest[2]) parts.push(GENDER[rest[2]] || '');
        if (rest[3]) parts.push(NUMBER[rest[3]] || '');
        break;
      }
      case 'R': {
        if (rest[0]) parts.push(STATE[rest[0]] || rest[0]);
        break;
      }
      // C (Conjunction), D (Adverb) have no sub-codes
    }

    return parts.filter(Boolean).join(', ');
  }

  /**
   * Decodes a full morphology code (may contain slashes for compound forms)
   * @param {string} morph - Full morph code, e.g. "R/Ncfsa" or "Vqp3ms"
   * @returns {string} Human-readable description
   */
  function decodeMorph(morph) {
    if (!morph) return '';
    return morph.split('/').map(decodeSegment).filter(Boolean).join(' + ');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = decodeMorph;
  } else {
    window.decodeMorph = decodeMorph;
  }
})();
