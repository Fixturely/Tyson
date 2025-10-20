import type { Config } from 'jest';

const config: Config = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
	transform: {
		'^.+\\.(ts|tsx)$': ['ts-jest', {
			useESM: true
		}],
	},
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},
	transformIgnorePatterns: [
		'node_modules/(?!(knex)/)'
	],
	setupFiles: ['dotenv/config'],
	globals: {
		'ts-jest': {
			diagnostics: true,
		},
	},
	verbose: true,
};

export default config;

