export class DaikinAPIError extends Error {
    public readonly statusCode?: number;
    public readonly originalError?: unknown;

    constructor(message: string, statusCode?: number, originalError?: unknown) {
        super(message);
        this.name = 'DaikinAPIError';
        this.statusCode = statusCode;
        this.originalError = originalError;

        // Restore prototype chain for instanceof checks
        Object.setPrototypeOf(this, DaikinAPIError.prototype);
    }

    public get userMessage(): string {
        switch (this.statusCode) {
            case 400:
                return 'Bad Request: The request to Daikin Cloud was invalid.';
            case 401:
                return 'Authentication Expired: Please restart Homebridge or re-authenticate.';
            case 403:
                return 'Access Denied: You do not have permission to access this resource.';
            case 429:
                return 'Rate Limit Exceeded: Too many requests to Daikin Cloud. Polling paused.';
            case 500:
                return 'Daikin Cloud Error: Internal server error.';
            case 502:
            case 503:
            case 504:
                return 'Daikin Cloud Unavailable: The service is temporarily down or under maintenance.';
            default:
                return this.message;
        }
    }
}
