# ONECTA Cloud API (v1.0.0)

## Base URLs

- `https://api.onecta.daikineurope.com/v1`: Server URL
- `https://api.onecta.daikineurope.com/mock/v1`: Server URL

## Endpoints

### blockSchedule

#### PUT `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/block-schedule/{mode}/schedules`

**Update the block schedules**

Update all block schedules information.

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |
| mode | path | string | Yes | The block schedule mode to update |

**Request Body**

- Content-Type: `application/json`
    - Schema: [BlockScheduleBodyV2](#schema-blockschedulebodyv2)

**Responses**

- `204`: Resource updated successfully
- `400`: Bad request
- `404`: Resource not found
- `409`: Conflict
- `500`: Internal server error

---

#### PUT `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/block-schedule/{mode}/current`

**Update the current block schedule**

Update which block schedule is currently active and enabled.

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |
| mode | path | string | Yes | The block schedule mode to update |

**Request Body**

- Content-Type: `application/json`
    - Schema: [CurrentBlockScheduleV2](#schema-currentblockschedulev2)

**Responses**

- `204`: Resource updated successfully
- `400`: Bad request
- `404`: Resource not found
- `409`: Conflict
- `500`: Internal server error

---

### characteristic

#### PATCH `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/characteristics/{name}`

**Update characteristic information.**

Update characteristic information.

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |
| name | path | string | Yes | The name of the characteristic to update |

**Request Body**

- Content-Type: `application/json`
    - Schema: [CharacteristicPatchValue](#schema-characteristicpatchvalue)

**Responses**

- `204`: Resource updated successfully
- `400`: Bad request

---

error codes:

- READ_ONLY_CHARACTERISTIC
- INVALID_CHARACTERISTIC_VALUE

* Schema: any
* `404`: Not found

---

error codes:

- GATEWAY_DEVICE_MISSING
- MANAGEMENT_POINT_MISSING
- CHARACTERISTIC_MISSING

* Schema: any
* `409`: Conflict

---

error codes:

- MANAGEMENT_POINT_BLOCKED

* Schema: any
* `422`: Unprocessable Entity

---

error codes:

- INVALID_REQUEST

* Schema: any
* `500`: Internal server error

---

### firmware

#### PUT `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/firmware/{firmwareId}`

**Update gatewaydevice with given firmware**

Update gatewaydevice with given firmware

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewaydevice |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |
| firmwareId | path | string | Yes | The id of the firmware |

**Responses**

- `204`: Resource updated successfully
- `500`: Internal server error

---

### gateway-device

#### GET `/gateway-devices`

**Get an array of gatewayDevices related to the user**

With all related management points and characteristics

**Responses**

- `200`: Successful operation
    - Schema: [GatewayDevices](#schema-gatewaydevices)
- `400`: Not found

---

error codes:

- GATEWAY_DEVICE_MISSING

* Schema: any
* `500`: Internal server error

---

#### GET `/gateway-devices/{gatewayDeviceId}`

**Get the gatewayDevice and all its management points**

With all their related characteristics

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |

**Responses**

- `200`: Successful operation
    - Schema: [GatewayDevice](#schema-gatewaydevice)
- `404`: Not found

---

error codes:

- GATEWAY_DEVICE_MISSING
- SITE_MISSING

* Schema: any
* `422`: Unprocessable Entity

---

error codes:

- INVALID_REQUEST

* Schema: any
* `500`: Internal server error

---

### holidayMode

#### POST `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/holiday-mode`

**Add a holiday period**

Insert a holiday period. By 1 January 2026, it will not be allowed anymore to include `startDate` and `endDate` parameters when disabling holiday mode.

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |

**Request Body**

- Content-Type: `application/json`
    - Schema: [HolidayModeBody](#schema-holidaymodebody)

**Responses**

- `204`: Resource updated successfully
- `400`: Bad request

---

error codes:

- READ_ONLY_CHARACTERISTIC
- INVALID_CHARACTERISTIC_VALUE

* Schema: any
* `404`: Not found

---

error codes:

- GATEWAY_DEVICE_MISSING
- MANAGEMENT_POINT_MISSING
- CHARACTERISTIC_MISSING

* Schema: any
* `409`: Conflict

---

error codes:

- MANAGEMENT_POINT_BLOCKED

* Schema: any
* `422`: Unprocessable Entity

---

error codes:

- INVALID_REQUEST

* Schema: any
* `500`: Internal server error

---

### info

#### GET `/info`

**Get service information**

This API endpoint is deprecated and will be unavailable by 1 January 2026

**Responses**

- `200`: Successful operation
    - Schema: [Info](#schema-info)
- `500`: Internal server error

---

### schedule

#### PUT `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/schedule/{mode}/schedules`

**Update the schedules**

Update all schedules information.

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |
| mode | path | string | Yes | The schedule mode to update |

**Request Body**

- Content-Type: `application/json`
    - Schema: [ScheduleBody](#schema-schedulebody)

**Responses**

- `204`: Resource updated successfully
- `400`: Bad request
- `404`: Resource not found
- `409`: Conflict
- `500`: Internal server error

---

#### PUT `/gateway-devices/{gatewayDeviceId}/management-points/{embeddedId}/schedule/{mode}/current`

**Update the current schedule**

Update which schedule is currently active and enabled.

**Parameters**
| Name | Location | Type | Required | Description |
|---|---|---|---|---|
| gatewayDeviceId | path | string | Yes | The id of the gatewayDevice to which the managementPoint belongs |
| embeddedId | path | string | Yes | The id of the managementPoint to which the characteristic belongs |
| mode | path | string | Yes | The schedule mode to update |

**Request Body**

- Content-Type: `application/json`
    - Schema: [CurrentSchedule](#schema-currentschedule)

**Responses**

- `204`: Resource updated successfully
- `400`: Bad request
- `404`: Resource not found
- `409`: Conflict
- `500`: Internal server error

---

### site

#### GET `/sites`

**Get all the sites related to the user.**

With all linked gateway device ids

**Responses**

- `200`: Successful operation
    - Schema: [Sites](#schema-sites)
- `500`: Internal server error

---

## Schemas

### <a id="schema-info"></a>Info

Type: `object`
| Property | Type | Description |
|---|---|---|
| app | string | The service name |
| versions | object | The versions of the service |

### <a id="schema-sites"></a>Sites

Type: `array`

### <a id="schema-gatewaydevices"></a>GatewayDevices

Type: `array`

### <a id="schema-error"></a>Error

Type: `object`
| Property | Type | Description |
|---|---|---|
| code | string | error code describing what went wrong |
| message | string | message describing why error occured |

### <a id="schema-gatewaydevice"></a>GatewayDevice

Type: `object`
| Property | Type | Description |
|---|---|---|
| isCloudConnectionUp | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| timestamp | string | dateTime when gateway device was last updated |
| mananagementPoints | [ManagementPoints](#schema-managementpoints) | |

### <a id="schema-characteristicpatchvalue"></a>CharacteristicPatchValue

Type: `object`
| Property | Type | Description |
|---|---|---|
| path | string | The path of the value that has to be changed (https://tools.ietf.org/html/rfc6901) |
| value | string | The value of the characteristic |

### <a id="schema-holidaymodebody"></a>HolidayModeBody

Type: `object`
| Property | Type | Description |
|---|---|---|
| enabled | boolean | Whether or not the holiday mode is enabled |
| startDate | string | The startDate of the holiday mode |
| endDate | string | The endDate of the holiday mode |

### <a id="schema-schedulebody"></a>ScheduleBody

Type: `object`

### <a id="schema-currentschedule"></a>CurrentSchedule

Type: `object`
| Property | Type | Description |
|---|---|---|
| scheduleId | string | The id of the current schedule |
| enabled | boolean | Whether the current schedule should be enabled or disabled |

### <a id="schema-blockschedulebodyv2"></a>BlockScheduleBodyV2

Type: `object`
| Property | Type | Description |
|---|---|---|
| name | object | |
| defaultBlockValues | object | |
| blocks | object | |

### <a id="schema-currentblockschedulev2"></a>CurrentBlockScheduleV2

Type: `object`
| Property | Type | Description |
|---|---|---|
| scheduleId | string | The id of the current block schedule |
| enabled | boolean | Whether the current block schedule should be enabled or disabled |

### <a id="schema-objectid"></a>ObjectId

Type: `object`
| Property | Type | Description |
|---|---|---|
| id | string | Object Id |

### <a id="schema-sitebody"></a>SiteBody

Type: `object`
| Property | Type | Description |
|---|---|---|
| name | string | The name of the site |
| role | string | The role of the user who did the request |
| location | object | The location details of the site |
| users | Array<object> | The users that are linked to a site |

### <a id="schema-booleancharacteristic"></a>BooleanCharacteristic

Type: `object`

### <a id="schema-managementpoints"></a>ManagementPoints

Type: `array`

### <a id="schema-gatewaydevicebody"></a>GatewayDeviceBody

Type: `object`
| Property | Type | Description |
|---|---|---|
| embeddedId | string | The internal device id |
| deviceModel | string | The model of the gateway device |

### <a id="schema-characteristicvalue"></a>CharacteristicValue

Type: `object`
| Property | Type | Description |
|---|---|---|
| value | string | The value of the characteristic |

### <a id="schema-booleancharacteristicmetadata"></a>BooleanCharacteristicMetaData

Type: `object`

### <a id="schema-managementpoint"></a>ManagementPoint

Type: `object`
| Property | Type | Description |
|---|---|---|
| embeddedId | string | The id of the embedded device, this id can contain a number or a string. |
| managementPointType | string | The type of a management point |
| managementPointSubType | string | The sub type of a management point |
| managementPointCategory | string | The category of a management point |
| name | [StringCharacteristic](#schema-stringcharacteristic) | |
| onOffMode | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |
| consumptionData | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| ipAddress | [StringCharacteristic](#schema-stringcharacteristic) | |
| macAddress | [StringCharacteristic](#schema-stringcharacteristic) | |
| firmwareVersion | [StringCharacteristic](#schema-stringcharacteristic) | |
| serialNumber | [StringCharacteristic](#schema-stringcharacteristic) | |
| modelInfo | [StringCharacteristic](#schema-stringcharacteristic) | |
| softwareVersion | [StringCharacteristic](#schema-stringcharacteristic) | |
| sensoryData | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| controlMode | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |
| powerfulMode | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |
| operationMode | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |
| temperatureControl | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| isInErrorState | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| isInWarningState | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| isInCautionState | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| isInInstallerState | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| isInEmergencyState | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| isHolidayModeActive | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| isPowerfulModeActive | [BooleanCharacteristic](#schema-booleancharacteristic) | |
| errorCode | [StringCharacteristic](#schema-stringcharacteristic) | |
| schedule | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| holidayMode | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| heatupMode | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |
| setpointMode | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |
| fanControl | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| humidityControl | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| firmwareUpdate | [ObjectCharacteristic](#schema-objectcharacteristic) | |
| firmwareUpdateStatus | [StringArrayCharacteristic](#schema-stringarraycharacteristic) | |

### <a id="schema-characteristicmetadatabody"></a>CharacteristicMetadataBody

Type: `object`
| Property | Type | Description |
|---|---|---|
| error | string | |
| settable | boolean | Whether or not the characteristic can be changed by the user |
| deprecated | string | Whether or not the characteristic is deprecated |

### <a id="schema-boolean"></a>Boolean

Type: `object`
| Property | Type | Description |
|---|---|---|
| value | boolean | |

### <a id="schema-stringcharacteristic"></a>StringCharacteristic

Type: `object`

### <a id="schema-stringarraycharacteristic"></a>StringArrayCharacteristic

Type: `object`

### <a id="schema-objectcharacteristic"></a>ObjectCharacteristic

Type: `object`

### <a id="schema-stringcharacteristicmetadata"></a>StringCharacteristicMetaData

Type: `object`

### <a id="schema-stringarraycharacteristicmetadata"></a>StringArrayCharacteristicMetaData

Type: `object`

### <a id="schema-objectcharacteristicmetadata"></a>ObjectCharacteristicMetaData

Type: `object`

### <a id="schema-string"></a>String

Type: `object`
| Property | Type | Description |
|---|---|---|
| value | string | The string value of this characteristic |
| maxLength | number | The max length of the characteristic |

### <a id="schema-stringarray"></a>StringArray

Type: `object`
| Property | Type | Description |
|---|---|---|
| value | string | The selected value of the StringArray characteristic. Should be part of the values as well. |
| values | Array<string> | The values allowed in this characteristic |

### <a id="schema-object"></a>Object

Type: `object`
| Property | Type | Description |
|---|---|---|
| value | object | The detail of this object can be found in the JSON schemas |
