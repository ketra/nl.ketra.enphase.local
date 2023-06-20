import exp from "constants";

export interface enphaseDevice {
    name?: string;
    data?: enphaseDeviceData;
}
export interface enphaseDeviceData {
    serial?: string;
    address?: string;
}

export interface EnlightenApiCredentials {
    username: string;
    password: string;
    serial: string;
}