import axios, { type AxiosInstance, type AxiosResponse } from 'axios';

/**
 * Configuration options for MaxflowClient
 */
export interface MaxflowConfig {
  apiKey?: string;     // Your public API key for authentication
  teamId?: string;     // Team identifier in Maxflow system
  applicationId?: string; // Application Identifier in Maxflow system
  baseURL?: string;    // Base URL for API requests (defaults to Maxflow cloud)
  apiSecret?: string;  // Secret key for secure endpoints
}

/**
 * Represents an item queued for batch "push" operations
 */
export interface QueueItem {
  data: any;                                   // Payload to send
  timestamp: number;                           // When the item was queued
  resolve: (response: AxiosResponse) => void;  // Promise resolver
  reject: (error: any) => void;                // Promise rejecter
  options?: PushOptions;                       // Debounce/immediate options
}

/**
 * Options controlling debounce behavior for push()
 */
export interface PushOptions {
  debounce?: number;           // Delay before sending batch (ms)
  debounce_max_wait?: number;  // Max wait time before flush (ms)
  immediately?: boolean;       // Send without batching
}

/**
 * Options for triggering workflows
 */
export interface RunOptions {
  data?: any;             // Request payload
  params?: any;           // URL query parameters
  callbackUrl?: string;  // Webhook to receive completion events
}

/**
 * Query parameters for searching pulses
 */
export interface findData {
  match?: {                 // Field-based filter conditions
    field: string;
    operator: string;
    value: any;
  }[] | Record<string, any>;
  page?: number;            // Page number
  pageSize?: number;        // Items per page
  sort?: string;            // Legacy sort field (optional)
  orderBy?: {               // Array of sort instructions
    field: string;
    order?: string;
    direction?: number;
  }[];
  search?: {                // Full-text search config
    fields: string[];
    text: string;
  };
}

/**
 * Primary client class for Maxflow API
 */
export default class MaxflowClient {
  private apiKey: string | null = null;   // Holds API key
  private apiSecret: string | null = null;// Holds API secret
  private teamId: string | null = null;   // Holds Team ID
  private applicationId: string | null = null // Holds Application ID
  private baseURL = 'https://app.gomaxflow.ai'; // Default API URL

  private queue: QueueItem[] = [];        // Internal queue buffer
  private pushTimeout: ReturnType<typeof setTimeout> | null = null;    // Debounce timer
  private maxAgeTimeout: ReturnType<typeof setTimeout> | null = null;  // Max-wait timer
  private readonly QUEUE_DELAY = 360;     // Default debounce delay (ms)
  private readonly MAX_QUEUE_TIME = 1000; // Default max wait time (ms)

  private axiosInstance: AxiosInstance | null = null; // Reusable HTTP client

  /**
   * Initialize client with optional config
   */
  constructor(config?: MaxflowConfig) {
    if (config) {
      this.apiKey = config.apiKey ?? null;
      this.teamId = config.teamId ?? null;
      this.apiSecret = config.apiSecret ?? null;
      this.applicationId = config.applicationId ?? null;
      this.baseURL = config.baseURL ?? this.baseURL;
    }
  }

  /**
   * Lazily instantiate and configure Axios instance
   */
  private http(auth = true): AxiosInstance {
    if (auth == false) {
      this.axiosInstance = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
        headers: {
          'x-max-team-id': this.teamId
        }
      });
      return this.axiosInstance;
    }
    if (!this.axiosInstance) {
      // Validate credentials before first use
      this.validateConfig();
      this.axiosInstance = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
      });
    }

    // Always set auth headers on each call
    const headers = this.axiosInstance.defaults.headers.common || {};
    headers['x-api-key'] = this.apiKey!;
    headers['x-max-team-id'] = this.teamId!;
    headers['x-api-secret'] = this.apiSecret!;
    headers['x-max-application-id'] = this.applicationId
    this.axiosInstance.defaults.baseURL = this.baseURL;

    return this.axiosInstance;
  }

  /**
   * Set or update the API key
   */
  setApiKey(key: string,secret:string) { this.apiKey = key; this.apiSecret = secret; return this; }

  /**
   * Set or update the Team ID
   */
  setTeamId(id: string) { this.teamId = id; return this; }

  /**
   * Set or update the Application ID
   */
  setApplicationId(id: string) { this.applicationId = id; return this; }

  /**
   * Set or update the Base URL
   */
  setBaseURL(url: string) { this.baseURL = url; return this; }

  /**
   * Ensure required config values are present
   */
  private validateConfig() {
    if (!this.teamId) throw new Error('Team ID is not set');
    if (!this.applicationId) throw new Error('Application ID is not set');
    if (!this.apiKey) throw new Error('API Key is not set');
    if (!this.apiSecret) throw new Error('API Secret is not set');
  }

  /**
   * Queue or immediately send a pulse event
   */
  async push(reqdata: any, options?: PushOptions): Promise<any> {
    // Immediate send bypasses queue
    if (options?.immediately) return this.pulse.push(reqdata);

    // Return a promise that resolves when the batch is processed
    return new Promise((resolve, reject) => {
      this.queue.push({
        data: reqdata,
        timestamp: Date.now(),
        resolve,
        reject,
        options
      });

      // Reset debounce timer
      if (this.pushTimeout) clearTimeout(this.pushTimeout);
      const debounceDelay = options?.debounce ?? this.QUEUE_DELAY;
      this.pushTimeout = setTimeout(() => this.processQueue(), debounceDelay);

      // On first queue item, also set a max-age timer
      if (this.queue.length === 1) {
        const maxWait = options?.debounce_max_wait ?? this.MAX_QUEUE_TIME;
        this.maxAgeTimeout = setTimeout(() => this.processQueue(), maxWait);
      }
    });
  }

  /**
   * Flush the queue by sending all items
   */
  private async processQueue() {
    if (this.queue.length === 0) return;

    const snapshot = [...this.queue];
    this.queue = [];

    // Clear any existing timers
    if (this.pushTimeout) { clearTimeout(this.pushTimeout); this.pushTimeout = null; }
    if (this.maxAgeTimeout) { clearTimeout(this.maxAgeTimeout); this.maxAgeTimeout = null; }

    // Process each queued item individually
    try {
      await Promise.all(
        snapshot.map(item =>
          this.pulse.push(item.data)
            .then(response => {
              item.resolve(response);
            })
            .catch(error => {
              item.reject(error);
            })
        )
      );
    } catch (error) {
      console.log(error)
    }
  }

  /**
   * Trigger a workflow run endpoint
   */
  async run(workflow_id: string, options: RunOptions={}) {
    try {
      return await this.http().post(
        `/api/workflow/run/${workflow_id}${options?.callbackUrl ? '?callbackUrl=' + options.callbackUrl : ''}`,
        {
          params: options?.params,
          data: options?.data,
        }
      );
    } catch (error) {
      throw error;
    }
  }

/**
 * Trigger a shared workflow run endpoint without authentication
 */
async runPublic(public_id: string, options: RunOptions={}) {
  try {
    return await this.http(false).post(`/api/integration/${this.teamId}/${public_id}${options?.callbackUrl ? '?callbackUrl=' + options.callbackUrl : ''}`,{
      params: options?.params,
      data: options?.data
    })
 }
 catch (error) {
  throw error;
 } 
}

/**
 * Get the status of a shared workflow
 */
async getExecutionPublicStatus(execution_id:string, public_id: string) {
  try {
    return await this.http(false).get(`/api/workflow/log?logId=${execution_id}&publicId=${public_id}`);
  } catch (error) {
    throw error;
  }
}

  /**
   * Fetch execution logs/status by ID
   */
  async getExecutionStatus(execution_id: string) {
    try {
      return await this.http().get(`/api/workflow/log?logId=${execution_id}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * CRUD operations for "pulse" resources
   */
  pulse = {
    push: async (data: Record<string, any> | Record<string, any>[]) =>{
      
      return this.http().post('/api/pulse', data)
    },

    get: async (pulse_id: string) =>{
      return this.http().get(`/api/pulse/${pulse_id}`)
    },

    find: async (data: findData) => {
      // Build query object from findData
      const query: Record<string, any> = {};
      if (data.match) {
        if (Array.isArray(data.match)) {
          query.match = {};
          for (const item of data.match) {
            query.match[item.field] = { [`$${item.operator}`]: item.value };
          }
        } else {
          query.match = { [data.match.field]: { [`$${data.match.operator}`]: data.match.value } };
        }
      }
      if (data.page !== undefined) query.page = data.page;
      if (data.pageSize !== undefined) query.pageSize = data.pageSize;
      if (data.search) query.search = data.search;
      if (data.orderBy) {
        query.orderBy = data.orderBy.map(item => ({
          field: item.field,
          direction: item.direction ?? (item.order === 'desc' ? -1 : 1)
        }));
      }
      const encoded = encodeURIComponent(JSON.stringify(query));
      return this.http().get(`/api/pulse/?o=${encoded}`);
    },

    delete: async (pulse_id: any) => {
     const pulseIds = Array.isArray(pulse_id) ? pulse_id : [pulse_id];
      return this.http().delete(`/api/pulse`, {
        data: pulseIds
      });
    }
  };
}
