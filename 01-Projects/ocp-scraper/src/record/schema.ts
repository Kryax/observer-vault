/**
 * OCP JSON-LD Context — inlined per draft-phase guidance.
 * From Observer Commons Protocol Schema Spec v0.1.0-draft.
 */
export const OCP_CONTEXT = {
  '@version': 1.1,
  'schema': 'https://schema.org/',
  'ocp': 'https://observercommons.org/ns/v1#',
  'dcterms': 'http://purl.org/dc/terms/',
  'skos': 'http://www.w3.org/2004/02/skos/core#',

  'SolutionRecord': 'ocp:SolutionRecord',

  'id': '@id',
  'type': '@type',

  'title': 'schema:name',
  'description': 'schema:description',
  'version': 'schema:version',
  'dateCreated': 'schema:dateCreated',
  'dateModified': 'schema:dateModified',
  'datePublished': 'schema:datePublished',
  'license': 'schema:license',
  'keywords': 'schema:keywords',
  'url': 'schema:url',

  'problemSolved': 'ocp:problemSolved',
  'problemStatement': 'ocp:problemStatement',
  'problemContext': 'ocp:problemContext',
  'cynefinDomain': 'ocp:cynefinDomain',
  'solutionApproach': 'ocp:solutionApproach',

  'domains': {
    '@id': 'ocp:domains',
    '@type': '@id',
    '@container': '@set',
  },

  'validation': 'ocp:validation',
  'validationMethod': 'ocp:validationMethod',
  'validationEvidence': 'ocp:validationEvidence',
  'validationDate': 'ocp:validationDate',
  'validatedBy': 'ocp:validatedBy',

  'implementation': 'ocp:implementation',
  'implementationType': 'ocp:implementationType',
  'implementationRefs': 'ocp:implementationRefs',
  'language': 'schema:programmingLanguage',
  'runtime': 'ocp:runtime',

  'composability': 'ocp:composability',
  'inputs': 'ocp:inputs',
  'outputs': 'ocp:outputs',
  'dependencies': 'ocp:dependencies',
  'composableWith': 'ocp:composableWith',
  'interfaceContract': 'ocp:interfaceContract',

  'provenance': 'ocp:provenance',
  'authors': {
    '@id': 'schema:author',
    '@container': '@list',
  },
  'contributors': {
    '@id': 'schema:contributor',
    '@container': '@list',
  },
  'sourceType': 'ocp:sourceType',
  'derivedFrom': {
    '@id': 'schema:isBasedOn',
    '@container': '@set',
  },
  'generatedBy': 'ocp:generatedBy',

  'trust': 'ocp:trust',
  'confidence': 'ocp:confidence',
  'authority': 'ocp:authority',
  'status': 'ocp:status',
  'endorsements': 'ocp:endorsements',
  'disputes': 'ocp:disputes',
  'trustScore': 'ocp:trustScore',

  'governance': 'ocp:governance',
  'owner': 'ocp:owner',
  'approvedBy': 'ocp:approvedBy',
  'approvalDate': 'ocp:approvalDate',

  'federation': 'ocp:federation',
  'originNode': 'ocp:originNode',
  'mirroredAt': 'ocp:mirroredAt',
  'canonicalUri': 'ocp:canonicalUri',

  'extensions': 'ocp:extensions',
} as const;
