import Homey from 'homey';
import EnlightenApi from './api';

class EnphaseDevice extends Homey.Device {

  private interval: number = 1000 * 30
  api: EnlightenApi | undefined;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('EnphaseDevice has been initialized');
    if (this.homey.settings.get('client')) {
      this.log('Initialising API');
      const settings = this.homey.settings.get('client');
      this.api = await EnlightenApi.createApi(settings.username, settings.password, settings.serial, settings.hostname);
      this.homey.setInterval(this.CollectData.bind(this), this.interval);
    } else {
      this.log('API details not found.');
    }
  }

  CollectData() {
    this.api?.GetData().then((data: any) => {
      this.setCapabilityValue('meter_power', data.wattHoursLifetime/ 1000).then();
      this.setCapabilityValue('measure_power', data.wattsNow).then();
    }).catch((r: any) => {
    });
  }

}

module.exports = EnphaseDevice;
