
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
			"branches": 70,
			"functions": 70,
			"lines": 70,
			"statements": 70
		}
	},
	verbose: true
}
