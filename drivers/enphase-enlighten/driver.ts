import Homey, { DiscoveryResultMDNSSD } from 'homey';
import PairSession from 'homey/lib/PairSession';
import EnlightenApi from './api';
import { enphaseDevice, enphaseDeviceData, EnlightenApiCredentials } from './types';

class EnphaseDriver extends Homey.Driver {

  api: EnlightenApi | undefined;
  device : enphaseDevice | undefined;

  apiCredentials: EnlightenApiCredentials | undefined;

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('EnphaseDriver has been initialized');
  }

  async onPair(session: PairSession) {
    session.setHandler('login', async (data) => {
      if (this.device?.data === undefined || this.device.data.serial === undefined) {
        this.log(`Received Login ${data.username} ${data.password} but no device selected yet.`);
        return false;
      }
      this.log(`Received Login ${data.username} ${data.password} ${this.device.data?.serial}`);
      this.apiCredentials = {username: data.username, password: data.password, serial: this.device.data?.serial};
      return EnlightenApi.TestCredentials(this.apiCredentials);
    });
    session.setHandler('list_devices_selection', async (data) => {
      try {
        this.device = {name: data[0].name, data: {serial: data[0].data.serial, address: data[0].data.address}};
      } catch (e) {
        console.log(e);
      }
    });
    session.setHandler('list_devices', async () => {
      const discoveryStrategy = this.getDiscoveryStrategy();
      const discoveryResults = discoveryStrategy.getDiscoveryResults();
      const devices = Object.values(discoveryResults).map((discoveryResult) => {
        const typedDiscoveryResult = discoveryResult as DiscoveryResultMDNSSD;
        return {
          name: typedDiscoveryResult.name,
          data: {
            serial: typedDiscoveryResult.id,
            address: typedDiscoveryResult.address,
          },
        };
      });
      return devices;
    });
    session.setHandler('getdata', async (data) => {
      if (this.device?.data === undefined || this.device.data.serial === undefined || this.device.data.address === undefined) {
        return null;
      }
      if (this.apiCredentials === undefined) {
        return null;
      }
      const deviceData = {
        name: this.device.name,
        data: {
          serial: this.device.data.serial,
          address: this.device.data.address,
        },
        store: {
          username: this.apiCredentials.username,
          password: this.apiCredentials.password,
          serial: this.apiCredentials.serial,
        },
      };
      session.emit('data', deviceData);
    });
  }

}

module.exports = EnphaseDriver;
