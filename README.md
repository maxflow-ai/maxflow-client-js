## Maxflow Client Library

A TypeScript client library for interacting with the Maxflow API. This document provides installation instructions, configuration options, usage examples, and a comprehensive API reference.

---

### 📦 Installation

Install via npm or yarn:

```bash
# Using npm
npm install @maxflow/client

# Using yarn
yarn add @maxflow/client
```

---

### 🔧 Setup & Configuration

Import and instantiate the client with your credentials:

```ts
import MaxflowClient, { MaxflowConfig } from '@maxflow/client';

const config: MaxflowConfig = {
  apiKey: 'YOUR_API_KEY',           // required
  teamId: 'YOUR_TEAM_ID',           // required
  apiSecret: 'YOUR_API_SECRET',     // required
  baseURL: 'https://maxflow.cloud'  // optional, defaults to Maxflow cloud
};

const client = new MaxflowClient(config);
```

You can also set or update credentials after instantiation:

```ts
client
  .setApiKey('NEW_API_KEY')
  .setTeamId('NEW_TEAM_ID')
  .setBaseURL('https://custom-domain.com');
```

---

### 🔗 API Reference

#### Interfaces

- **`MaxflowConfig`**
  ```ts
  interface MaxflowConfig {
    apiKey?: string;
    teamId?: string;
    apiSecret?: string;
    baseURL?: string;
  }
  ```
  Configuration options for the client.

- **`PushOptions`**
  ```ts
  interface PushOptions {
    debounce?: number;           // time in ms before processing queue
    debounce_max_wait?: number;  // maximum wait time in ms to flush queue
    immediately?: boolean;       // bypass queue and send immediately
  }
  ```
  Options for the `push()` method batching behavior.

- **`RunOptions`**
  ```ts
  interface RunOptions {
    data?: any;                  // payload data
    params?: any;                // query parameters
    callback_url?: string;       // optional webhook URL
  }
  ```
  Options for executing a workflow.

- **`findData`**
  ```ts
  interface findData {
    match?: { field: string; operator: string; value: any }[] | Record<string, any>;
    page?: number;
    pageSize?: number;
    sort?: string;
    orderBy?: { field: string; order?: string; direction?: number }[];
    search?: { fields: string[]; text: string };
  }
  ```
  Query structure for searching pulse items.

---

#### Class: `MaxflowClient`

##### `constructor(config?: MaxflowConfig)`
Creates a new client. Passing a `config` object with `apiKey`, `teamId`, and `apiSecret` initializes credentials.

##### **Setters**
- `setApiKey(key: string): this` — update the API key.
- `setTeamId(id: string): this` — update the Team ID.
- `setBaseURL(url: string): this` — update the base URL.

##### **Methods**

- **`push(reqdata: any, options?: PushOptions): Promise<any>`**
  Queue a pulse event. By default, requests are batched using debounce logic. Pass `{ immediately: true }` to send instantly.

- **`run(workflow_id: string, options: RunOptions): Promise<AxiosResponse>`**
  Trigger a workflow run. Returns the server response including `executionId`.

- **`getExecutionStatus(execution_id: string): Promise<AxiosResponse>`**
  Fetch status and logs for a given execution ID.

---

### 📦 Pulse Namespace

Convenience methods for CRUD operations on pulses:

| Method                      | Signature                                                              | Description                                  |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------- |
| `pulse.create(data)`        | `(data: any | any[]) => Promise<AxiosResponse>`                  | Create one or multiple pulses.               |
| `pulse.get(pulse_id)`       | `(pulse_id: string) => Promise<AxiosResponse>`                        | Retrieve a pulse by ID.                      |
| `pulse.find(query: findData)`| `(data: findData) => Promise<AxiosResponse>`                         | Search pulses with filters, pagination, etc. |
| `pulse.update(pulse_id, data)`| `(pulse_id: string, data: Record<string,any>) => Promise<AxiosResponse>` | Update a pulse’s data.    |
| `pulse.delete(pulse_id)`    | `(pulse_id: string) => Promise<AxiosResponse>`                        | Delete a pulse by ID.                        |

---

### 📖 Usage Examples

```ts
// Batch push
await client.push({ action: 'click', element: 'button' });

// Immediate push
await client.push({ event: 'login' }, { immediately: true });

// Run a workflow
const runRes = await client.run('workflow123', {
  data: { foo: 'bar' },
  callback_url: 'https://myapp.com/webhook'
});

// Check execution status
tconst statusRes = await client.getExecutionStatus(runRes.data.executionId);

// Find pulses
const searchRes = await client.pulse.find({
  match: [{ field: 'status', operator: 'eq', value: 'active' }],
  page: 1,
  pageSize: 20,
  search: { fields: ['user'], text: 'alice' }
});
```

---

### 🚨 Error Handling

All methods throw an `Error` for missing config or HTTP failures. Wrap calls in `try/catch`:

```ts
try {
  const res = await client.pulse.get('pulse123');
} catch (err) {
  console.error('Error fetching pulse:', err.message);
}
```

---

### 🔒 Authentication & Headers

Upon first request, the client validates that `apiKey`, `teamId`, and `apiSecret` are set. Requests include headers:

```
x-api-key: YOUR_API_KEY
x-max-team-id: YOUR_TEAM_ID
x-api-secret: YOUR_API_SECRET
```

---

_For full source and release history, see the [GitHub repo](https://github.com/maxflow-ai/maxflow-client-js)._

