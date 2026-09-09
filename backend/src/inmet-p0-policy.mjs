import { createHash } from 'node:crypto';

import { ClientInputError } from './core.mjs';
import { validateP0Alert } from './fcm.mjs';
import { INMET_SOURCE_ID } from './inmet-source.mjs';
import { findRjMunicipality } from './rio-municipalities.mjs';

export const INMET_P0_POLICY_ID = 'inmet-cap-to-p0-v1';

const P0_SEVERITIES = new Set(['Extreme', 'Severe']);
const P0_URGENCIES = new Set(['Immediate', 'Expected']);
const P0_CERTAINTIES = new Set(['Observed', 'Likely']);
const FUTURE_SKEW_MILLIS = 5 * 60 * 1000;
const MAX_P0_VALIDITY_MILLIS = 24 * 60 * 60 * 1000;

export class InmetP0PolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = 'InmetP0PolicyError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function frozenDecision(identifier, reason) {
  return Object.freeze({ identifier, reason });
}

function p0Id(identifier, scope) {
  return `inmet:${sha256(`${identifier}|${scope}`)}`;
}

function candidateFor(warning, city) {
  const alert = {
    id: p0Id(warning.identifier, city?.ibge ?? 'RJ'),
    authority: 'official',
    severity: 'P0',
    title: warning.event,
    source: 'INMET CAP',
    issuedAt: warning.sent,
    expiresAt: warning.expires,
  };
  if (city) {
    alert.cityName = city.name;
    alert.cityIbge = city.ibge;
  }
  return alert;
}

function normalizedScopes(warning) {
  const ibges = Array.isArray(warning.rjMunicipalityIbges) ? warning.rjMunicipalityIbges : [];
  if (ibges.length > 0) {
    const unique = [...new Set(ibges)].sort();
    return unique.map((ibge) => {
      const city = findRjMunicipality(ibge);
      if (!city) throw new InmetP0PolicyError('inmet_p0_unknown_municipality');
      return city;
    });
  }
  if (warning.rjMatchMethod === 'CAP_GEOCODE_BR_RJ' || warning.rjMatchMethod === 'CAP_AREA_DESC_RIO_DE_JANEIRO') {
    return [null];
  }
  throw new InmetP0PolicyError('inmet_p0_unresolved_rj_scope');
}

export function evaluateInmetP0Policy(snapshot, nowMillis = Date.now()) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new InmetP0PolicyError('inmet_p0_snapshot_invalid');
  }
  if (snapshot.sourceId !== INMET_SOURCE_ID || !Array.isArray(snapshot.rjWarnings)) {
    throw new InmetP0PolicyError('inmet_p0_source_contract_invalid');
  }
  if (!Number.isFinite(nowMillis)) throw new InmetP0PolicyError('inmet_p0_now_invalid');

  const candidates = [];
  const blocked = [];
  const ineligible = [];

  for (const warning of snapshot.rjWarnings) {
    if (!warning || typeof warning !== 'object' || !warning.affectsRioDeJaneiro) {
      throw new InmetP0PolicyError('inmet_p0_warning_invalid');
    }

    if (!P0_SEVERITIES.has(warning.severity)
      || !P0_URGENCIES.has(warning.urgency)
      || !P0_CERTAINTIES.has(warning.certainty)) {
      ineligible.push(frozenDecision(warning.identifier, 'below_p0_threshold'));
      continue;
    }

    const sentMillis = Date.parse(warning.sent);
    const expiresMillis = Date.parse(warning.expires);
    if (!Number.isFinite(sentMillis) || !Number.isFinite(expiresMillis)) {
      blocked.push(frozenDecision(warning.identifier, 'invalid_time'));
      continue;
    }
    if (sentMillis > nowMillis + FUTURE_SKEW_MILLIS) {
      blocked.push(frozenDecision(warning.identifier, 'future_sent'));
      continue;
    }
    if (expiresMillis <= nowMillis) {
      blocked.push(frozenDecision(warning.identifier, 'expired'));
      continue;
    }
    if (expiresMillis <= sentMillis || expiresMillis - sentMillis > MAX_P0_VALIDITY_MILLIS) {
      blocked.push(frozenDecision(warning.identifier, 'p0_validity_too_long'));
      continue;
    }

    let scopes;
    try {
      scopes = normalizedScopes(warning);
    } catch (error) {
      if (error instanceof InmetP0PolicyError) {
        blocked.push(frozenDecision(warning.identifier, error.code));
        continue;
      }
      throw error;
    }

    let schemaBlocked = null;
    const staged = [];
    for (const city of scopes) {
      const alert = candidateFor(warning, city);
      try {
        validateP0Alert(alert, nowMillis);
      } catch (error) {
        if (error instanceof ClientInputError) {
          schemaBlocked = error.message || 'p0_schema_rejected';
          break;
        }
        throw error;
      }
      staged.push(Object.freeze({
        sourceIdentifier: warning.identifier,
        scope: city ? 'MUNICIPALITY' : 'STATEWIDE',
        alert: Object.freeze(alert),
      }));
    }

    if (schemaBlocked) {
      blocked.push(frozenDecision(warning.identifier, schemaBlocked));
      continue;
    }
    candidates.push(...staged);
  }

  return Object.freeze({
    policyId: INMET_P0_POLICY_ID,
    sourceId: INMET_SOURCE_ID,
    evaluatedAt: new Date(nowMillis).toISOString(),
    candidateCount: candidates.length,
    blockedCount: blocked.length,
    ineligibleCount: ineligible.length,
    candidates: Object.freeze(candidates),
    blocked: Object.freeze(blocked),
    ineligible: Object.freeze(ineligible),
    delivery: 'NOT_PERFORMED_POLICY_EVALUATION_ONLY',
    threshold: 'SEVERE_OR_EXTREME+IMMEDIATE_OR_EXPECTED+OBSERVED_OR_LIKELY',
    municipalScope: 'EXACT_CANONICAL_IBGE_WHEN_PRESENT',
  });
}
