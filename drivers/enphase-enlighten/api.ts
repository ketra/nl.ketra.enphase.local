// eslint-disable-next-line strict,node/no-unsupported-features/es-syntax
import https from 'node:https';
import axios, { AxiosResponse } from 'axios';
import { EnlightenApiCredentials} from "./types";

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

    static async createApi(apiCredentials: EnlightenApiCredentials, hostname: string) {
      const api = new EnlightenApi(apiCredentials.username, apiCredentials.password, apiCredentials.serial, hostname);
      await api.CreateClient();
      return api;
    }

    static async TestCredentials(apiCredentials: EnlightenApiCredentials) {
      const loginPayload = { 'user[email]': apiCredentials.username, 'user[password]': apiCredentials.password };
      let options = {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      };
      const res = await axios.post(ENLIGHTEN_AUTH_JSON_URL, loginPayload, options);
      const { session_id } = res.data;
      const tokenPayload = { session_id, serial_num: apiCredentials.serial, username: apiCredentials.username };
      options = {
        headers: { 'content-type': 'application/json' },
      };
      const response = await axios.post(TOKEN_URL, tokenPayload, options);
      const token = <string>response.data.trim('\n');
      const parsedToken = this.parseJwt(token);
      return parsedToken.username === apiCredentials.username;
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

    async GetCookie() {
      if (this.client.defaults.headers.common['Authorization']) {
        this.client.get('auth/check_jwt').then((result: any) => {
          this.client.defaults.headers.common['Cookie'] = result.headers['set-cookie'][0];
        });
      } else {
        this.CollectToken().then(this.GetCookie);
      }
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
        this.checkLogin().then(() => {
          this.client.get('api/v1/production').then((data: { data: object; }) => {
            resolve(data.data);
          }).catch((err: any) => {
            reject(err);
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
