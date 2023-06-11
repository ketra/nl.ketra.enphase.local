import Homey, { DiscoveryResultMDNSSD } from 'homey';
import EnlightenApi from './api';
import { EnlightenApiCredentials } from './types';

class EnphaseDevice extends Homey.Device {

  private interval: number = 1000 * 10
  api: EnlightenApi | undefined;

  apiCredentials: EnlightenApiCredentials | undefined;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('EnphaseDevice has been initialized');
    if (this.homey.settings.get('client')) {
      this.log('Initialising API');
      const store = this.getStore();
      const data = this.getData();
      this.apiCredentials = { username: store.username, password: store.password, serial: store.serial };
      this.api = await EnlightenApi.createApi(this.apiCredentials, data.address);
      this.homey.setInterval(this.CollectData.bind(this), this.interval);
    } else {
      this.log('API details not found.');
    }
    if (!this.hasCapability('meter_power.today')) {
      await this.addCapability('meter_power.today');
    }
    if (!this.hasCapability('meter_power.7days')) {
      await this.addCapability('meter_power.7days');
    }
  }

  async onDiscoveryAvailable(discoveryResult: DiscoveryResultMDNSSD) {
    // This method will be executed once when the device has been found (onDiscoveryResult returned true)
    if (this.apiCredentials === undefined) {
      return;
    }
    this.api = await EnlightenApi.createApi(this.apiCredentials, discoveryResult.address);
  }

  async onDiscoveryAddressChanged(discoveryResult: DiscoveryResultMDNSSD) {
    if (this.apiCredentials === undefined) {
      return;
    }
    this.api = await EnlightenApi.createApi(this.apiCredentials, discoveryResult.address);
  }

  CollectData() {
    this.api?.GetData().then((data: any) => {
      const collectDate = new Date(data.production[0].readingTime * 1000).toISOString()
      this.log(`data from ${collectDate} -  power_meter" ${data.production[0].whLifetime}, power: ${data.production[0].wNow}`);
      this.setCapabilityValue('meter_power', data.wattHoursLifetime / 1000).then();
      this.setCapabilityValue('measure_power', data.wattsNow).then();
      this.setCapabilityValue('meter_power.today', data.wattHoursToday / 1000).then();
      this.setCapabilityValue('meter_power.7days', data.wattHoursSevenDays / 1000).then();
    }).catch((r: any) => {
    });
  }

  async onDeleted() {
    this.homey.clearInterval(this.interval);
  }

}

module.exports = EnphaseDevice;
