import { Logger as HomebridgeLogger } from 'homebridge';

export class DaikinLogger {
    constructor(
        private readonly logger: HomebridgeLogger,
        private readonly prefix?: string,
        private readonly debugMode: boolean = false,
    ) {}

    private formatMessage(message: string, ...parameters: unknown[]): string {
        const msg = parameters.length ? `${message} ${JSON.stringify(parameters)}` : message;
        return this.prefix ? `[${this.prefix}] ${msg}` : msg;
    }

    info(message: string, ...parameters: unknown[]): void {
        this.logger.info(this.formatMessage(message, ...parameters));
    }

    warn(message: string, ...parameters: unknown[]): void {
        this.logger.warn(this.formatMessage(message, ...parameters));
    }

    error(message: string, ...parameters: unknown[]): void {
        this.logger.error(this.formatMessage(message, ...parameters));
    }

    debug(message: string, ...parameters: unknown[]): void {
        if (this.debugMode) {
            this.logger.info(this.formatMessage(message, ...parameters));
        } else {
            this.logger.debug(this.formatMessage(message, ...parameters));
        }
    }
}
