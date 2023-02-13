import Homey from 'homey';
import PairSession from 'homey/lib/PairSession';
import EnlightenApi from './api';

class EnphaseDriver extends Homey.Driver {

  api: EnlightenApi | undefined;

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('EnphaseDriver has been initialized');
  }

  async onPair(session: PairSession) {
    session.setHandler('login', async (data) => {
      return EnlightenApi.TestCredentials(data.username, data.password, data.serial);
    });
    session.setHandler('Done', async (data) => {
      this.api = await EnlightenApi.createApi(data.username, data.password, data.serial, data.hostname);
      const client = {
        username: this.api.username,
        password: this.api.password,
        serial: this.api.serial,
        hostname: this.api.hostname,
      };
      this.homey.settings.set('client', client);
    });
  }

}

module.exports = EnphaseDriver;
