/** Display names for a project's `kind`, shared by the index, the featured cards and the filter. */
export const kindLabels = {
	fullstack: 'Full-Stack',
	agent: 'KI-Agent',
	orchestration: 'Orchestrierung',
	static: 'Statische Seite',
} as const;

export type ProjectKind = keyof typeof kindLabels;
