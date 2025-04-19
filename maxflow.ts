import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

export interface MaxFlowConfig {
  apiKey?: string;
  teamId?: string;
  baseURL?: string;
  apiSecret?: string;
}

export interface QueueItem {
  data: any;
  timestamp: number;
  resolve: (response: AxiosResponse) => void;
  reject: (error: any) => void;
  options?: PushOptions;
}

export interface PushOptions {
  debounce?: number;
  debounce_max_wait?: number;
  immediately?: boolean;
}

export interface RunOptions {
  data?: any;
  params?: any;
  callback_url?: string;
}

export interface findData {
  match?: {
    field: string;
    operator: string;
    value: any;
  }[] | Record<string, any>;
  page?: number | 1;
  pageSize?: number | 30;
  sort?: string;
  orderBy?:{
      field: string;
      order?: string;
      direction?: number;
    }[];
  search?: {
    fields: string[];
    text: string;
  };
}

class MaxFlow {
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private teamId: string | null = null;
  private baseURL = 'https://maxflow.cloud';
  private queue: QueueItem[] = [];
  private pushTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxAgeTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly QUEUE_DELAY = 360;
  private readonly MAX_QUEUE_TIME = 1000;
  private axiosInstance: AxiosInstance | null = null;

  constructor(config?: MaxFlowConfig) {
    if (config) {
      this.apiKey = config.apiKey ?? null;
      this.teamId = config.teamId ?? null;
      this.apiSecret = config.apiSecret ?? null;
      this.baseURL = config.baseURL ?? this.baseURL;
    }
  }

  private http(): AxiosInstance {
    if (!this.axiosInstance) {
      this.validateConfig();
      this.axiosInstance = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
      });
    }
    
    const headers = this.axiosInstance.defaults.headers.common || {};
    headers['x-api-key'] = this.apiKey!;
    headers['x-max-team-id'] = this.teamId!;
    headers['x-api-secret'] = this.apiSecret!;
    this.axiosInstance.defaults.baseURL = this.baseURL;
    
    return this.axiosInstance;
  }

  setApiKey(key: string) { this.apiKey = key; return this; }
  setTeamId(id: string) { this.teamId = id; return this; }
  setBaseURL(url: string) { this.baseURL = url; return this; }

  private validateConfig() {
    if (!this.apiKey) throw new Error('API Key is not set');
    if (!this.teamId) throw new Error('Team ID is not set');
    if (!this.apiSecret) throw new Error('API Secret is not set');
  }
  
  async push(reqdata: any, options?: PushOptions): Promise<any> {
    if (options?.immediately) return this.pulse.create(reqdata);
    
    return new Promise((resolve, reject) => {
      this.queue.push({ 
        data: reqdata, 
        timestamp: Date.now(), 
        resolve, 
        reject,
        options
      });
  
      if (this.pushTimeout) clearTimeout(this.pushTimeout);
      
      const debounceDelay = options?.debounce ?? this.QUEUE_DELAY;
      this.pushTimeout = setTimeout(() => this.processQueue(), debounceDelay);
  
      if (this.queue.length === 1) {
        const maxWait = options?.debounce_max_wait ?? this.MAX_QUEUE_TIME;
        this.maxAgeTimeout = setTimeout(() => this.processQueue(), maxWait);
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) return;
  
    const snapshot = [...this.queue];
    this.queue = []; 
  
    if (this.pushTimeout) {
      clearTimeout(this.pushTimeout);
      this.pushTimeout = null;
    }
    if (this.maxAgeTimeout) {
      clearTimeout(this.maxAgeTimeout);
      this.maxAgeTimeout = null;
    }
  
    try {
      await Promise.all(snapshot.map(async (item) => {
        try {
          item.resolve(await this.pulse.create(item.data));
        } catch (error) {
          item.reject(error);
        }
      }));
    } catch (error) {
      snapshot.forEach(item => item.reject(error));
    }
  }

  async run(workflow_id: string, options: RunOptions) {
    try {
      return await this.http().post(`/api/workflow/run/${workflow_id}`, {
        params: options.params,
        payload: options.data,
        callback_url: options.callback_url
      });
    } catch (error) {
      throw error;
    }
  }

  async getExecutionStatus(execution_id: string) {
    try {
      return await this.http().get(`/api/workflow/log?logId=${execution_id}`);
    } catch (error) {
      throw error;
    }
  }

  pulse = {
    create: async (data: Record<string, any> | Record<string, any>[]) => 
      this.http().post('/api/pulse', data),
    
    get: async (pulse_id: string) => 
      this.http().get(`/api/pulse/${pulse_id}`),
    
    find: async (data: findData) => {
      const query: Record<string, any> = {};
      
      if (data.match) {
        if (Array.isArray(data.match)) {
          query.match = {};
          for (const item of data.match) {
            if (!query.match[item.field]) {
              query.match[item.field] = {};
            }
            query.match[item.field] = {
              [`$${item.operator}`]: item.value
            };
          }
        } else {
         query.match[data.match.field] = {
          [`$${data.match.operator}`]: data.match.value
         }
        }
      }
      
      if (data.page !== undefined) {
        query.page = data.page;
      }
      
      if (data.pageSize !== undefined) {
        query.pageSize = data.pageSize;
      }
      
      if (data.search) {
        query.search = data.search;
      }
      
      if (data.orderBy) {
        query.orderBy = data.orderBy.map(item => ({
          field: item.field,
          direction: item.direction || (item.order === 'desc' ? -1 : 1)
        }));
      }
      
      const encodedQuery = encodeURIComponent(JSON.stringify(query));
      
      return this.http().get(`/api/pulse/?o=${encodedQuery}`);
    },
    
    delete: async (pulse_id: string) => 
      this.http().delete(`/api/pulse/${pulse_id}`),
    
    update: async (pulse_id: string, data: Record<string, any>) => 
      this.http().put(`/api/pulse/${pulse_id}`, data)
  };
}

export default MaxFlow;

