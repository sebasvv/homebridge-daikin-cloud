# Homebridge Daikin Cloud

<p align="center">
  <a href="https://github.com/sebasvv/homebridge-daikin-cloud/actions/workflows/ci.yml"><img src="https://github.com/sebasvv/homebridge-daikin-cloud/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://www.npmjs.com/package/@sebasvv/homebridge-daikin-cloud"><img src="https://ignite.dev/badges/npm-version" alt="NPM Version"></a>
  <a href="https://github.com/sebasvv/homebridge-daikin-cloud/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
</p>

This Homebridge plugin connects to the Daikin Cloud to control your air conditioning, Altherma heat pump, and other Daikin devices via HomeKit.

## Features

- **Control Modes**: Cooling, Heating, Auto, Dry*, Fan Only*.
- **Fan Control**: Adjust fan speed and swing modes (Vertical/Horizontal).
- **Special Modes**: Powerful, Econo, Streamer, Indoor/Outdoor Silent.
- **Real-time Feedback**: Updates status from cloud polling.
- **Type-Safe & Validated**: Built with strict TypeScript and runtime configuration validation.

_\* HomeKit limitations apply for some specific modes._

## Installation

```bash
# Install specific scoped package
npm install -g @sebasvv/homebridge-daikin-cloud
```

## Configuration

Add the `DaikinCloud` platform to your `config.json`.

> [!IMPORTANT]
> This plugin validates configuration at startup. Invalid config will cause the plugin to stop to prevent errors.

```json
{
    "platforms": [
        {
            "platform": "DaikinCloud",
            "clientId": "YOUR_CLIENT_ID",
            "clientSecret": "YOUR_CLIENT_SECRET",
            "oidcCallbackServerBindAddr": "0.0.0.0",
            "callbackServerExternalAddress": "192.168.1.100",
            "callbackServerPort": 8582,
            "showExtraFeatures": true,
            "updateIntervalInMinutes": 15
        }
    ]
}
```

### Setup Guide

1.  **Daikin Developer Portal**: Create an app at [Daikin Europe Developer Portal](https://developer.cloud.daikineurope.com/).
    - **Redirect URI**: `https://<YOUR_HOMEBRIDGE_IP>:<PORT>` (e.g., `https://192.168.1.100:8582`).
2.  **Homebridge Config**: Enter the Client ID and Secret from the portal.

## Troubleshooting

- **Authentication**: Delete `.daikin-controller-cloud-tokenset` in your storage folder to force re-authentication.
- **Logs**: Check Homebridge logs. This plugin uses structured logging for easier debugging.

## Development

This project adheres to **Clean Architecture** principles and strict quality standards.

- **Services**: Business logic in `src/services/`.
- **Accessories**: distinct accessory implementations in `src/accessories/`.
- **Validation**: Zod schemas in `src/config.ts`.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on how to build, test, and contribute.

---

Credits: Based on the original work by JeroenVdb and the Daikin Cloud API library by Apollon77.
