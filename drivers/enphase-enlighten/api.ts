// eslint-disable-next-line strict,node/no-unsupported-features/es-syntax
import https from 'node:https';
import axios, { AxiosResponse } from 'axios';

const ENLIGHTEN_AUTH_JSON_URL = 'https://enlighten.enphaseenergy.com/login/login.json?';
const TOKEN_URL = 'https://entrez.enphaseenergy.com/tokens';

// eslint-disable-next-line node/no-unsupported-features/es-syntax
export default class EnlightenApi {

    username: string;
    password: string;
    serial: string;
    hostname: string
    private client: any;
    private token: string | undefined

    private constructor(username: string, password: string, serial: string, hostname: string) {
      this.username = username;
      this.password = password;
      this.serial = serial;
      this.hostname = hostname;
    }

    static async createApi(username: string, password: string, serial: string, hostname: string) {
      const api = new EnlightenApi(username, password, serial, hostname);
      await api.CreateClient();
      return api;
    }

    static async TestCredentials(username: string, password: string, serial: string) {
      const loginPayload = { 'user[email]': username, 'user[password]': password };
      let options = {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      };
      const res = await axios.post(ENLIGHTEN_AUTH_JSON_URL, loginPayload, options);
      const { session_id } = res.data;
      const tokenPayload = { session_id, serial_num: serial, username };
      options = {
        headers: { 'content-type': 'application/json' },
      };
      const response = await axios.post(TOKEN_URL, tokenPayload, options);
      const token = <string>response.data.trim('\n');
      const parsedToken = this.parseJwt(token);
      return parsedToken.username === username;
    }

    private async CreateClient() {
      this.client = axios.create({
        baseURL: `https://${this.hostname}/`,
        timeout: 10000,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });
      this.CollectToken().then();

      // Set that 401 is not a breaking error.
      this.client.interceptors.response.use((response: any) => {
        return response;
      }, (error: { response: { status: number; }; }) => {
        if (error.response.status === 401) {
          console.log('Error 401');
          this.CollectToken();
        }
        return error;
      });
      if (this.token === '') {
        await this.CollectToken();
      }
    }

    async CollectToken() {
      return new Promise((resolve, reject) => {
      // Create basic client
        const client = axios.create({
          withCredentials: true,
        });
        // Get sessionID for later use to get token.
        const loginPayload = { 'user[email]': this.username, 'user[password]': this.password };
        let options = {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        };
        client.post(ENLIGHTEN_AUTH_JSON_URL, loginPayload, options).then((res: AxiosResponse) => {
          const SessionId = res.data.session_id;
          const tokenPayload = { session_id: SessionId, serial_num: this.serial, username: this.username };

          options = {
            headers: { 'content-type': 'application/json' },
          };
          client.post(TOKEN_URL, tokenPayload, options).then((response: AxiosResponse) => {
            const token = <string>response.data.trim('\n');
            console.log(`Setting token to ${token}`);
            this.token = token;
            this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            resolve(token);
          });
        });
      });
    }

    async CheckCookie() {
      return new Promise<void>((resolve, reject) => {
        this.client.get('auth/check_jwt').then((result: any) => {
          if (result.headers['set-cookie']) {
            this.client.defaults.headers.common['Cookie'] = result.headers['set-cookie'][0];
          } else {
            this.client.defaults.headers.common['Cookie'] = result.config.headers['Cookie'];
          }
          resolve();
        });
      });
    }

    static parseJwt(token: any) {
      const jsonToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return jsonToken;
    }

    async checkLogin() {
      return new Promise<void>((resolve, reject) => {
        if (this.token === '' || this.token === undefined) {
          console.log('Token not found, collecting token.');
          this.CollectToken().then(() => {
            resolve();
          });
        } else {
          const expiredate: number = (Date.now() - 1000 / 1000);
          if (EnlightenApi.parseJwt(this.token).exp > expiredate) {
            console.log('Token expired refreshing');
            this.CollectToken().then(() => {
              resolve();
            });
          }
          resolve();
        }
      });
    }

    GetData() {
      return new Promise((resolve, reject) => {
        this.CheckCookie().then(() => {
          this.checkLogin().then(() => {
            this.client.get('production.json').then((data: { data: object; }) => {
              resolve(data.data);
            }).catch((err: any) => {
              reject(err);
            });
          });
        });
      });
    }

    GetInverter() {
      return new Promise((resolve, reject) => {
        this.client.get('api/v1/inverters').then((data: { data: object; }) => {
          console.log(data.data);
          resolve(data.data);
        }).catch((err: any) => {
          reject(err);
        });
      });
    }

}
