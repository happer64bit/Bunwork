import { join } from "path";
import { file } from "bun";

export type Middleware = (req: Request, res: Response, next: () => void) => void;

export interface IRequest extends Request {
    params?: { [key: string]: string };
}

// Represents the main Bunwork server class
export default class Bunwork {
    // Stores the middleware functions
    private middlewares: Middleware[];
    // Stores the routes with methods as keys (GET/POST) and path mappings
    private routes: {
        GET: { [key: string]: { handler: Function; isDynamic: boolean } };
        POST: { [key: string]: { handler: Function; isDynamic: boolean } };
    };
    // Stores the static route mappings
    private staticRoutes: { [route: string]: string };

    constructor() {
        this.middlewares = [];
        this.routes = { GET: {}, POST: {} };
        this.staticRoutes = {}; // Store static route mappings
    }

    /**
     * Adds a middleware function to the stack
     * @param fn The middleware function to add
     */
    middleware(fn: (req: IRequest, res: Response, next: () => void) => void): void {
        this.middlewares.push(fn);
    }

    /**
     * Registers a GET route
     * @param path The route path
     * @param handler The handler function for the route
     */
    get(path: string, handler: Function): void {
        this.routes.GET[path] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    /**
     * Registers a POST route
     * @param path The route path
     * @param handler The handler function for the route
     */
    post(path: string, handler: Function): void {
        this.routes.POST[path] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    /**
     * Checks if a route path contains dynamic segments (i.e. `:param`)
     * @param path The route path
     * @returns True if the route is dynamic, false otherwise
     */
    private isDynamicRoute(path: string): boolean {
        return path.includes(':');
    }

    /**
     * Matches the requested path and HTTP method to a route
     * @param path The requested path
     * @param method The HTTP method (GET, POST)
     * @returns The matched route handler and parameters if found, null otherwise
     */
    private matchRoute(path: string, method: "GET" | "POST"): { handler: Function; params: { [key: string]: string } } | null {
        const routeObject = this.routes[method];
        for (const routePath in routeObject) {
            const route = routeObject[routePath];
            if (!route.isDynamic) {
                if (routePath === path) {
                    return { handler: route.handler, params: {} };
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

    /**
     * Builds a regex for matching dynamic route segments
     * @param path The route path
     * @returns A regular expression to match the dynamic route
     */
    private buildRouteRegex(path: string): RegExp {
        const regexPath = path.replace(/:\w+/g, '([\\w-]+)');
        return new RegExp(`^${regexPath}$`);
    }

    /**
     * Extracts dynamic parameters from a matched route
     * @param routePath The route path
     * @param match The regex match result
     * @returns An object with the extracted parameters
     */
    private extractParams(routePath: string, match: RegExpMatchArray): { [key: string]: string } {
        const params: { [key: string]: string } = {};
        const keys = routePath.match(/:\w+/g) || [];
        keys.forEach((key, index) => {
            params[key.slice(1)] = match[index + 1];
        });
        return params;
    }

    /**
     * Registers a static route to serve files from a specific directory
     * @param route The route prefix for the static file serving
     * @param directoryPath The path to the directory for static files
     */
    static(route: string, directoryPath: string): void {
        this.staticRoutes[route] = directoryPath;
    }

    /**
     * Registers blueprint routes and middlewares
     * @param blueprint The blueprint instance containing routes and middlewares
     */
    registerBlueprint(blueprint: Blueprint): void {
        this.middlewares.push(...blueprint.getMiddlewares());
        const blueprintRoutes = blueprint.getRoutes();
        for (const method in blueprintRoutes) {
            for (const path in blueprintRoutes[method as "GET" | "POST"]) {
                this.routes[method as "GET" | "POST"][path] = blueprintRoutes[method as "GET" | "POST"][path];
            }
        }
    }

    /**
     * Starts the server and begins listening for requests
     * @param port The port number to listen on
     * @param callback A callback function that is invoked when the server is ready
     */
    listen(port: number, callback?: () => void): void {
        Bun.serve({
            port,
            fetch: async (req: IRequest) => {
                const url = new URL(req.url);
                const method = req.method.toUpperCase() as "GET" | "POST";

                // Middleware processing
                for (const middleware of this.middlewares) {
                    let nextCalled = false;
                    const next = () => { nextCalled = true; };
                    await middleware(req, new Response(), next);
                    if (!nextCalled) return new Response("Middleware blocked the request", { status: 403 });
                }

                // Check for matching API route first
                const routeHandler = this.matchRoute(url.pathname, method);
                if (routeHandler) {
                    if (routeHandler.params) {
                        req.params = routeHandler.params;
                    }
                    return await routeHandler.handler(req);
                }

                // If no API route matches, check static routes
                for (const [staticRoute, dirPath] of Object.entries(this.staticRoutes)) {
                    if (url.pathname.startsWith(staticRoute)) {
                        const filePath = join(dirPath, url.pathname.slice(staticRoute.length));
                        try {
                            return new Response(await file(filePath).arrayBuffer(), { status: 200 });
                        } catch {
                            return new Response("File Not Found", { status: 404 });
                        }
                    }
                }

                // If neither API nor static route matches, return 404
                return new Response("Not Found", { status: 404 });
            },
        });

        if (callback) callback();
    }

    handle(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const method = req.method.toUpperCase() as "GET" | "POST";

        // Middleware processing
        const runMiddlewares = async () => {
            for (const middleware of this.middlewares) {
                let nextCalled = false;
                const next = () => { nextCalled = true; };
                await middleware(req as IRequest, new Response(), next);
                if (!nextCalled) return new Response("Middleware blocked the request", { status: 403 });
            }
            return null;
        };

        return (async () => {
            const blockedRes = await runMiddlewares();
            if (blockedRes) return blockedRes;

            const routeHandler = this.matchRoute(url.pathname, method);
            if (routeHandler) {
                if (routeHandler.params) {
                    (req as IRequest).params = routeHandler.params;
                }
                return await routeHandler.handler(req);
            }

            for (const [staticRoute, dirPath] of Object.entries(this.staticRoutes)) {
                if (url.pathname.startsWith(staticRoute)) {
                    const filePath = join(dirPath, url.pathname.slice(staticRoute.length));
                    try {
                        return new Response(await file(filePath).arrayBuffer(), { status: 200 });
                    } catch {
                        return new Response("File Not Found", { status: 404 });
                    }
                }
            }

            return new Response("Not Found", { status: 404 });
        })();
    }
}

// Represents a blueprint for organizing related routes and middlewares
export class Blueprint {
    // The prefix for all routes in this blueprint
    private prefix: string;
    // Stores the routes for this blueprint
    private routes: {
        GET: { [key: string]: { handler: Function; isDynamic: boolean } };
        POST: { [key: string]: { handler: Function; isDynamic: boolean } };
    };
    // Stores the middleware functions for this blueprint
    private middlewares: Array<(req: IRequest, res: Response, next: () => void) => void>;

    constructor(prefix: string) {
        this.prefix = prefix;
        this.routes = { GET: {}, POST: {} };
        this.middlewares = [];
    }

    /**
     * Adds a middleware function to the blueprint
     * @param fn The middleware function to add
     */
    middleware(fn: (req: IRequest, res: Response, next: () => void) => void): void {
        this.middlewares.push(fn);
    }

    /**
     * Registers a GET route in the blueprint
     * @param path The route path (relative to the blueprint prefix)
     * @param handler The handler function for the route
     */
    get(path: string, handler: Function): void {
        this.routes.GET[`${this.prefix}${path}`] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    /**
     * Registers a POST route in the blueprint
     * @param path The route path (relative to the blueprint prefix)
     * @param handler The handler function for the route
     */
    post(path: string, handler: Function): void {
        this.routes.POST[`${this.prefix}${path}`] = { handler, isDynamic: this.isDynamicRoute(path) };
    }

    /**
     * Checks if a route path contains dynamic segments (i.e. `:param`)
     * @param path The route path
     * @returns True if the route is dynamic, false otherwise
     */
    private isDynamicRoute(path: string): boolean {
        return path.includes(':');
    }

    /**
     * Retrieves all the routes for this blueprint
     * @returns An object containing GET and POST routes
     */
    getRoutes(): { GET: { [key: string]: { handler: Function; isDynamic: boolean } }; POST: { [key: string]: { handler: Function; isDynamic: boolean } } } {
        return this.routes;
    }

    /**
     * Retrieves all the middlewares for this blueprint
     * @returns An array of middleware functions
     */
    getMiddlewares(): Array<(req: IRequest, res: Response, next: () => void) => void> {
        return this.middlewares;
    }
}
