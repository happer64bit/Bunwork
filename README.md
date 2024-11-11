# BunWork `Simplicity == Joy`

_Bun refers to the Just Bun runtime, while Work refers to the framework._

Bunwork is just a `Bun.serve` based but make it easier for developer, designed to simplify HTTP server setup and routing for developers.

## Features

* Middleware support
* Route definition with dynamic parameters
* Blueprint-based routing (modular route groups)
* Easy integration with `Bun.serve`

## Installation

To use Bunwork, you need to have [Bun](https://bun.sh) installed.

To install Bunwork in your project, you can simply add it to your codebase as follows:

```bash
bun add bunwork
```

## Usage

### 1. Create a Server

```javascript
import Bunwork from "bunwork";

const app = new Bunwork();

// Define middleware
app.middleware((req, res, next) => {
    console.log(`Request made to ${req.url}`);
    next();  // Call next() to continue processing the request
});

// Define GET route
app.get('/hello/:name', (req) => {
    const url = new URL(req.url);
    const id = url.pathname.split('/')[2];
    
    return new Response(`Hello, ${name}!`);
});

// Define POST route
app.post('/data', (req) => {
    // Process POST data here
    return new Response('Data received');
});

// Start the server
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
```

### 2. Define Dynamic Routes

Dynamic routes allow you to capture variables from the URL path. In the example below, the :name part of the URL is a dynamic parameter.

```javascript
app.get('/hello/:name', (req) => {
    const { name } = req.params;  // Extract dynamic parameter
    return new Response(`Hello, ${name}!`);
});
```

For instance, requesting `/hello/john` will return `"Hello, john!"`.

### 3. Using Blueprints

Blueprints allow you to group routes and middlewares into modular sections with a common prefix.

```javascript
import { Blueprint } from "bunwork";

// Create a new blueprint with a prefix
const userBlueprint = new Blueprint('/users');

// Define routes within the blueprint
userBlueprint.get('/:id', (req) => {
    const { id } = req.params;
    return new Response(`User ID: ${id}`);
});

userBlueprint.post('/:id/update', (req) => {
    const { id } = req.params;
    return new Response(`User ${id} updated`);
});

// Register the blueprint to the main app
app.registerBlueprint(userBlueprint);
```

This will allow you to have routes like `/users/1` and `/users/1/update`.

### 4. Middleware

Middleware functions are executed for every request. You can use them to log requests, handle authentication, or manipulate request/response objects before they reach your route handler.

```javascript
app.middleware((req, res, next) => {
    console.log(`Request received at ${req.url}`);
    next();  // Proceed to the next middleware or route handler
});
```

### 5. Handling Errors

You can handle errors gracefully by adding custom error handling middleware.

```javascript
app.middleware((req, res, next) => {
    try {
        next();
    } catch (err) {
        console.error('Error occurred:', err);
        return new Response('Internal Server Error', { status: 500 });
    }
});
```