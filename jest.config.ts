
export default {
	"collectCoverage": true,
	"collectCoverageFrom": ['src/**/*.ts'],
	"coverageDirectory": 'coverage',
	"testMatch": [
		"**/?(*.)+(spec|test).+(ts|tsx|js)"
	],
	"transform": {
		"^.+\\.(ts|tsx)$": "ts-jest"
	},
	"coverageThreshold": {
		"global": {
			"branches": 90,
			"functions": 80,
			"lines": 80,
			"statements": 80
		}
	},
	verbose: true
}
