export default class Bunwork {
    constructor() {
        this.middlewares = [];
        this.routes = { GET: {}, POST: {} };
    }

    middleware(fn) {
        this.middlewares.push(fn);
    }

    get(path, handler) {
        this.routes.GET[path] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    post(path, handler) {
        this.routes.POST[path] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    // Helper method to check if a route is dynamic
    isDynamicRoute(path) {
        return path.includes(':');
    }

    // Helper method to match dynamic routes
    matchRoute(path, method) {
        const routeObject = this.routes[method];
        for (const routePath in routeObject) {
            const route = routeObject[routePath];
            if (!route.isDynamic) {
                if (routePath === path) {
                    return route.handler;
                }
            } else {
                const regex = this.buildRouteRegex(routePath);
                const match = path.match(regex);
                if (match) {
                    return { handler: route.handler, params: this.extractParams(routePath, match) };
                }
            }
        }
        return null;
    }

    // Build a regex from the route pattern with dynamic segments
    buildRouteRegex(path) {
        const regexPath = path.replace(/:\w+/g, '([\\w-]+)');
        return new RegExp(`^${regexPath}$`);
    }

    // Extract dynamic parameters from a route match
    extractParams(routePath, match) {
        const params = {};
        const keys = routePath.match(/:\w+/g) || [];
        keys.forEach((key, index) => {
            params[key.slice(1)] = match[index + 1];
        });
        return params;
    }

    registerBlueprint(blueprint) {
        // Add blueprint middlewares to server middlewares
        this.middlewares.push(...blueprint.getMiddlewares());

        // Add blueprint routes to server routes
        const blueprintRoutes = blueprint.getRoutes();
        for (const method in blueprintRoutes) {
            for (const path in blueprintRoutes[method]) {
                this.routes[method][path] = blueprintRoutes[method][path];
            }
        }
    }

    listen(port, callback) {
        Bun.serve({
            port,
            fetch: async (req) => {
                const url = new URL(req.url);
                const method = req.method.toUpperCase();

                // Middleware processing
                for (const middleware of this.middlewares) {
                    let nextCalled = false;
                    const next = () => { nextCalled = true; };
                    await middleware(req, new Response(), next);
                    if (!nextCalled) return new Response("Middleware blocked the request", { status: 403 });
                }

                // Route handling with dynamic parameters
                const routeHandler = this.matchRoute(url.pathname, method);
                if (routeHandler) {
                    // If dynamic parameters were found, pass them to the handler
                    if (routeHandler.params) {
                        req.params = routeHandler.params;
                    }
                    return await routeHandler.handler(req);
                } else {
                    return new Response("Not Found", { status: 404 });
                }
            },
        });

        if (callback) callback();
    }
}

class Blueprint {
    constructor(prefix) {
        this.prefix = prefix;
        this.routes = { GET: {}, POST: {} };
        this.middlewares = [];
    }

    middleware(fn) {
        this.middlewares.push(fn);
    }

    get(path, handler) {
        this.routes.GET[`${this.prefix}${path}`] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    post(path, handler) {
        this.routes.POST[`${this.prefix}${path}`] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    // Helper method to check if a route is dynamic
    isDynamicRoute(path) {
        return path.includes(':');
    }

    getRoutes() {
        return this.routes;
    }

    getMiddlewares() {
        return this.middlewares;
    }
}
