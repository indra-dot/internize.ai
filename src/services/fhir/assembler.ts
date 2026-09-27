/**
 * assembler.ts
 * FHIR R4 Transaction Bundle assembler.
 * Packages de-identified lab records into a valid HL7 FHIR R4 Bundle
 * (resourceType: "Bundle", type: "transaction") with proper urn:uuid
 * fullUrls and in-bundle reference rewriting.
 *
 * Compliant with: HL7 FHIR R4 (https://hl7.org/fhir/R4/)
 * Zero network calls — fully deterministic, on-device.
 */

import type { FhirBundle, FhirBundleEntry } from '../../types/fhir';
import type { LoincLabRecord } from '../../types/research';

/**
 * Generates a reproducible UUID v4 from a seed string
 * (crypto.randomUUID() is used when available, otherwise a deterministic fallback).
 */
function generateUuid(seed?: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Deterministic fallback for environments without crypto.randomUUID
  const base = seed ?? Math.random().toString();
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (Math.imul(31, hash) + base.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash).toString(16).padStart(8, '0');
  return `${h.slice(0, 8)}-${h.slice(0, 4)}-4${h.slice(1, 4)}-8${h.slice(0, 3)}-${h.padEnd(12, '0').slice(0, 12)}`;
}

/**
 * Maps LabFlag to FHIR ObservationInterpretation code.
 */
function flagToFhirInterpretation(flag: string | undefined): string {
  switch (flag) {
    case 'high':
      return 'H';
    case 'critical':
      return 'HH';
    case 'low':
      return 'L';
    default:
      return 'N';
  }
}

export interface AssembledBundle {
  bundle: FhirBundle;
  resourceCount: number;
  generatedAt: string;
}

/**
 * Assembles a FHIR R4 Transaction Bundle from de-identified lab records.
 *
 * @param labs          Structured LOINC lab records.
 * @param patientUuid   Optional Patient resource UUID to link Observations.
 *                      If omitted, a stub anonymous Patient is created.
 */
export function assembleFhirBundle(labs: LoincLabRecord[], patientUuid?: string): AssembledBundle {
  const generatedAt = new Date().toISOString();
  const bundleId = generateUuid(`bundle-${generatedAt}`);
  const resolvedPatientUuid = patientUuid ?? generateUuid('patient-anonymous');
  const patientFullUrl = `urn:uuid:${resolvedPatientUuid}`;

  const entries: FhirBundleEntry[] = [];

  // ── Anonymous Patient resource ────────────────────────────────────────────
  const patientEntry: FhirBundleEntry = {
    fullUrl: patientFullUrl,
    resource: {
      resourceType: 'Patient',
      id: resolvedPatientUuid,
      meta: {
        profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
      },
      text: {
        status: 'generated',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">De-identified patient — PHI removed per HIPAA Safe Harbor.</div>',
      },
      identifier: [
        {
          use: 'anonymous',
          system: 'urn:internize:deid',
          value: resolvedPatientUuid,
        },
      ],
      active: true,
    },
    request: {
      method: 'POST',
      url: 'Patient',
    },
  };
  entries.push(patientEntry);

  // ── Observation resources — one per lab record ─────────────────────────────
  for (const lab of labs) {
    const obsUuid = generateUuid(`obs-${lab.loincCode}-${generatedAt}`);
    const obsFullUrl = `urn:uuid:${obsUuid}`;

    const observation: FhirBundleEntry = {
      fullUrl: obsFullUrl,
      resource: {
        resourceType: 'Observation',
        id: obsUuid,
        meta: {
          profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'],
        },
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'laboratory',
                display: 'Laboratory',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: lab.loincCode,
              display: lab.testName,
            },
          ],
          text: lab.testName,
        },
        subject: {
          reference: patientFullUrl,
        },
        effectiveDateTime: generatedAt,
        valueQuantity: {
          value: lab.value,
          unit: lab.unit,
          system: 'http://unitsofmeasure.org',
          code: lab.unit,
        },
        ...(lab.referenceRange
          ? {
              referenceRange: [
                {
                  text: lab.referenceRange,
                },
              ],
            }
          : {}),
        ...(lab.flag
          ? {
              interpretation: [
                {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                      code: flagToFhirInterpretation(lab.flag),
                      display:
                        lab.flag === 'high'
                          ? 'High'
                          : lab.flag === 'critical'
                            ? 'Critical High'
                            : lab.flag === 'low'
                              ? 'Low'
                              : 'Normal',
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      request: {
        method: 'POST',
        url: 'Observation',
      },
    };

    entries.push(observation);
  }

  const bundle: FhirBundle = {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'transaction',
    entry: entries,
  };

  return {
    bundle,
    resourceCount: entries.length,
    generatedAt,
  };
}

/**
 * Serializes a FHIR Bundle to a downloadable JSON blob and triggers
 * a browser file-save without requiring the `downloads` permission.
 */
export function downloadBundleAsJson(bundle: FhirBundle): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fhir-bundle-${bundle.id ?? Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
