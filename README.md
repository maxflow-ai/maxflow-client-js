# Maxflow AI Client Library

A lightweight, flexible JavaScript/TypeScript client for interacting with the Maxflow AI platform. This library provides a clean interface for sending data to Maxflow, triggering workflows, and managing pulses (data events).

## Installation

```bash
npm install maxflow-client
```

or

```bash
yarn add maxflow-client
```

## Quick Start

```javascript
import MaxflowClient from 'maxflow-client';

// Initialize the client
const client = new MaxflowClient({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
  teamId: 'YOUR_TEAM_ID'
});

// Send a simple pulse event
client.pulse.push({ 
  event: 'user_login', 
  userId: '12345', 
  timestamp: Date.now() 
})
  .then(response => console.log('Success:', response.data))
  .catch(error => console.error('Error:', error));
```

## Configuration

When initializing the client, you can provide several configuration options:

```javascript
const client = new MaxflowClient({
  apiKey: 'YOUR_API_KEY',       // Required for authenticated endpoints
  apiSecret: 'YOUR_API_SECRET', // Required for authenticated endpoints
  teamId: 'YOUR_TEAM_ID',       // Your team identifier in Maxflow
  baseURL: 'https://custom.maxflow.instance.com' // Optional custom endpoint
});
```

You can also set or update these values after initialization:

```javascript
client.setApiKey('NEW_API_KEY', 'NEW_API_SECRET');
client.setTeamId('NEW_TEAM_ID');
client.setBaseURL('NEW_BASE_URL');
```

## Core Features

### Pushing Data ("Pulses")

Pulses are data events you send to Maxflow. They can be sent individually or in batches.

#### Immediate Push

For immediate sending without batching:

```javascript
// Send a single pulse
client.pulse.push({ 
  action: 'purchase', 
  amount: 99.99,
  productId: 'xyz-123' 
});

// Send multiple pulses in one request
client.pulse.push([
  { action: 'page_view', page: '/home' },
  { action: 'button_click', element: 'signup_button' }
]);
```

#### Smart Batching with Debounce

For efficiency, you can use the smart batching feature which groups multiple calls together:

```javascript
// These will be automatically batched together
client.push({ event: 'track_event', name: 'view_item' });
client.push({ event: 'track_event', name: 'add_to_cart' });
client.push({ event: 'track_event', name: 'begin_checkout' });

// Control batching behavior
client.push(
  { event: 'important_event', priority: 'high' },
  { 
    debounce: 500,             // Wait 500ms before sending
    debounce_max_wait: 2000,   // But don't wait longer than 2 seconds
    immediately: false         // Don't send immediately (use batching)
  }
);
```

### Running Workflows

Trigger Maxflow workflows with optional data and callback URLs:

```javascript
// Simple workflow trigger
client.run('workflow-id-123')
  .then(response => {
    const executionId = response.data.execution_id;
    console.log(`Workflow started with execution ID: ${executionId}`);
  });

// With payload data and parameters
client.run('workflow-id-123', {
  data: {
    user: {
      name: 'Jane Doe',
      email: 'jane@example.com'
    }
  },
  params: {
    mode: 'production',
    notify: true
  },
  callbackUrl: 'https://your-app.com/webhook/maxflow'
});
```

### Public Workflow Endpoints

For workflows that are shared publicly:

```javascript
// Run a public workflow without authentication
client.runPublic('public-workflow-id', {
  data: {
    message: 'Hello from the public API!'
  }
})
  .then(response => {
    const executionId = response.data.execution_id;
    console.log(`Public workflow started: ${executionId}`);
  });

// Check status of a public workflow execution
client.getRunPublicStatus('execution-id-123', 'public-workflow-id')
  .then(response => {
    console.log('Execution status:', response.data.status);
    console.log('Workflow output:', response.data.output);
  });
```

### Managing Pulses

Query, retrieve, and delete pulses (data events):

```javascript
// Find pulses with filtering
client.pulse.find({
  match: [
    { field: 'event', operator: 'eq', value: 'user_signup' },
    { field: 'timestamp', operator: 'gte', value: Date.now() - 86400000 }
  ],
  page: 1,
  pageSize: 50,
  orderBy: [{ field: 'timestamp', order: 'desc' }],
  search: {
    fields: ['userId', 'email'],
    text: 'john.doe@example'
  }
})
  .then(response => {
    console.log(`Found ${response.data.total} matching pulses`);
    console.log('Results:', response.data.results);
  });

// Get a specific pulse by ID
client.pulse.get('pulse-id-123')
  .then(response => {
    console.log('Pulse data:', response.data);
  });

// Delete a pulse
client.pulse.delete('pulse-id-123');

// Delete multiple pulses
client.pulse.delete(['pulse-id-123', 'pulse-id-456']);
```

### Checking Workflow Execution Status

Monitor the status of workflow executions:

```javascript
client.getExecutionStatus('execution-id-123')
  .then(response => {
    console.log('Status:', response.data.status);
    console.log('Start time:', response.data.startedAt);
    console.log('End time:', response.data.endedAt);
    console.log('Duration:', response.data.duration, 'ms');
    console.log('Output:', response.data.output);
  });
```

## Advanced Features

### Custom Query Format for Finding Pulses

For advanced filtering, you can use a more concise object notation:

```javascript
client.pulse.find({
  match: {
    userId: { $eq: '12345' },
    createdAt: { $gte: '2023-01-01' }
  },
  page: 1,
  pageSize: 25
});
```

### Error Handling

The client throws standard errors that can be caught and handled:

```javascript
try {
  await client.run('workflow-id-123');
} catch (error) {
  if (error.response) {
    // The server responded with a status code outside the 2xx range
    console.error('API error:', error.response.status, error.response.data);
  } else if (error.request) {
    // The request was made but no response was received
    console.error('Network error:', error.request);
  } else {
    // Something else happened while setting up the request
    console.error('Client error:', error.message);
  }
}
```

## TypeScript Support

This library includes TypeScript definitions for all methods and interfaces:

```typescript
import MaxflowClient, { MaxflowConfig, RunOptions, findData } from 'maxflow-client';

// Type-safe configuration
const config: MaxflowConfig = {
  apiKey: 'key',
  apiSecret: 'secret',
  teamId: 'team123'
};

const client = new MaxflowClient(config);

// Type-safe run options
const options: RunOptions = {
  data: { userId: 123 },
  params: { mode: 'test' }
};

// Type-safe find query
const query: findData = {
  match: [
    { field: 'status', operator: 'eq', value: 'active' }
  ],
  pageSize: 10
};
```

## FAQ

**Q: Do I need both an API key and API secret?**  
A: Yes, for most operations you need both. The API key identifies your application while the API secret authenticates it. Public workflow endpoints are the exception.

**Q: How does the batching system work?**  
A: When you use `client.push()`, events are queued and sent together after a short delay (default: 360ms) or when a maximum wait time is reached (default: 1000ms). This improves efficiency by reducing API calls.

**Q: Can I use this library in a browser environment?**  
A: Yes, but we recommend keeping your API secret secure by using this library in backend environments or through a proxy service.

**Q: How do I handle pagination when finding pulses?**  
A: Use the `page` and `pageSize` parameters in your find query to navigate through results:

```javascript
// Get first page
const firstPage = await client.pulse.find({ page: 1, pageSize: 50 });
// Get next page
const nextPage = await client.pulse.find({ page: 2, pageSize: 50 });
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This library is released under the MIT License.