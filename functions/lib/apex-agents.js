// Internal APEX agent orchestration. This is a deterministic, zero-extra-inference
// dispatch layer; it does not pretend to run independent model instances or external tools.
const AGENTS = {
  agriculture: {
    id: 'field-intelligence',
    remit: 'Agronomy, soil, crops, livestock, and farm operations.',
    instruction: 'Check biological and operational assumptions; flag local climate, pesticide, animal-health, and food-safety facts that require current verification.'
  },
  finance: {
    id: 'commercial-risk',
    remit: 'Finance, economics, budgeting, credit, and unit economics.',
    instruction: 'Check arithmetic, cash-flow implications, downside risk, and distinguish education from individualized advice.'
  },
  business: {
    id: 'venture-strategy',
    remit: 'Business models, commerce, partnerships, and revenue operations.',
    instruction: 'Check customer value, feasibility, unit economics, and whether every commercial claim is supported.'
  },
  legal: {
    id: 'compliance-review',
    remit: 'Legal concepts, jurisdiction, and compliance research.',
    instruction: 'Flag jurisdiction/date sensitivity and avoid definitive legal conclusions.'
  },
  health_safety: {
    id: 'safety-review',
    remit: 'Human, animal, and workplace safety.',
    instruction: 'Prioritize immediate safety, avoid diagnosis/prescription, and direct emergencies to appropriate services.'
  },
  technology: {
    id: 'systems-architecture',
    remit: 'Software, AI, automation, cybersecurity, and engineering.',
    instruction: 'Check security boundaries, data exposure, failure modes, and implementation feasibility.'
  },
  research: {
    id: 'evidence-review',
    remit: 'Research quality, education, and evidence assessment.',
    instruction: 'Separate verified facts, inference, estimates, and unknowns; never fabricate sources.'
  },
  media: {
    id: 'brand-relations',
    remit: 'Media, bookings, appearances, sponsorships, and partnerships.',
    instruction: 'Verify public claims and route serious inquiries to official booking/contact channels.'
  },
  marketing: {
    id: 'growth-strategy',
    remit: 'Positioning, audience, SEO, content, and conversion.',
    instruction: 'Optimize for qualified outcomes and trust, not deceptive urgency or vanity metrics.'
  },
  operations: {
    id: 'operations-control',
    remit: 'Workflows, logistics, scheduling, procurement, and service quality.',
    instruction: 'Identify dependencies, operational controls, and measurable next steps.'
  },
  general: {
    id: 'visitor-experience',
    remit: 'Visitor intent, brand knowledge, and useful next steps.',
    instruction: 'Answer directly and route visitors only to relevant, verified official destinations.'
  }
};

export function buildAgentPlan(specialists = ['general']) {
  const selected = [...new Set((Array.isArray(specialists) ? specialists : ['general'])
    .filter(name => Object.hasOwn(AGENTS, name)))].slice(0, 2);
  if (!selected.length) selected.push('general');
  return {
    agents: selected.map(name => ({ ...AGENTS[name], discipline: name })),
    execution: 'parallel_review_then_single_synthesis',
    toolPermissions: [],
    externalActionsAllowed: false,
    revealInternalRouting: false
  };
}

export function buildAgentInstructions(plan) {
  const assignments = plan.agents.map((agent, index) =>
    'INTERNAL REVIEW ' + (index + 1) + ' — ' + agent.discipline.toUpperCase() +
    ' (' + agent.remit + ')\n' + agent.instruction
  ).join('\n\n');
  return 'INTERNAL APEX QUALITY ORCHESTRATION\nUse the following specialist reviews as analytical lenses, then produce one coherent answer. Do not mention internal agent names, routing, or orchestration to the visitor. No agent has permission to call external tools, access private data, or take actions.\n\n' + assignments +
    '\n\nSYNTHESIS GATE\nResolve conflicts conservatively. Do not invent consensus. State material uncertainty, preserve the base safety and privacy rules, and give the visitor one practical next step.';
}
