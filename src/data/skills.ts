/**
 * Skills grouped by domain rather than listed as one flat row, so the core
 * stack reads louder than the long tail. `core: true` marks the technologies
 * the hero actually claims as primary: only those are shown there, the full
 * list sits under the career timeline.
 */
export const skillGroups = [
	{
		label: 'Frontend',
		skills: [
			{ name: 'TypeScript', core: true },
			{ name: 'React', core: true },
			{ name: 'Next.js', core: true },
			{ name: 'Astro', core: false },
			{ name: 'JavaScript', core: false },
			{ name: 'Tailwind CSS', core: false },
			{ name: 'HTML', core: false },
			{ name: 'CSS', core: false },
		],
	},
	{
		label: 'Backend',
		skills: [
			{ name: 'Node.js', core: true },
			{ name: 'NestJS', core: true },
			{ name: 'PostgreSQL', core: false },
			{ name: 'SQL', core: false },
			{ name: 'SQLite', core: false },
			{ name: 'WebSockets', core: false },
			{ name: 'JWT', core: false },
			{ name: 'Python', core: false },
			{ name: 'Java', core: false },
			{ name: 'PHP', core: false },
			{ name: 'TYPO3', core: false },
			{ name: 'WordPress', core: false },
		],
	},
	{
		label: 'KI',
		skills: [
			{ name: 'LangGraph', core: true },
			{ name: 'RAG', core: true },
			{ name: 'MCP', core: true },
			{ name: 'OpenAI', core: false },
			{ name: 'Claude', core: false },
			{ name: 'Copilot', core: false },
		],
	},
	{
		label: 'DevOps & Tools',
		skills: [
			{ name: 'CI/CD', core: true },
			{ name: 'GitHub Actions', core: false },
			{ name: 'Docker', core: false },
			{ name: 'Azure', core: false },
			{ name: 'Git / GitLab', core: false },
			{ name: 'Linux', core: false },
			{ name: 'Vitest', core: false },
		],
	},
];

export const coreSkills = skillGroups.flatMap((group) => group.skills.filter((skill) => skill.core));
export const otherSkillCount = skillGroups.reduce((sum, group) => sum + group.skills.length, 0) - coreSkills.length;
