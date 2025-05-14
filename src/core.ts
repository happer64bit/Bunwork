import Bun from 'bun';
import { join } from 'path';

export type Middleware = (req: Request, next: () => void) => Awaited<void> | Promise<void> | void;

export type Handler = (req: Request) => Response | Promise<Response>;

export default class Bunwork {
    middlewares: Middleware[];
    routes: { [route: string]: { [method: string]: Handler } };
    staticRoutes: { [route: string]: string };

    constructor() {
        this.middlewares = [];
        this.routes = {};
        this.staticRoutes = {};
    }

    // Add middleware
    middleware(fn: Middleware): void {
        this.middlewares.push(fn);
    }

    // Register a GET route
    get(path: string, handler: Handler): void {
        this.addRoute("GET", path, handler);
    }

    // Register a POST route
    post(path: string, handler: Handler): void {
        this.addRoute("POST", path, handler);
    }

    // Static route handling (serve static files from specific directory)
    static(route: string, directoryPath: string): void {
        this.staticRoutes[route] = directoryPath;
    }

    // Register routes using route object with method-based handlers
    private addRoute(method: "GET" | "POST", path: string, handler: Handler): void {
        if (!this.routes[path]) {
            this.routes[path] = {};
        }
        this.routes[path][method] = handler;
    }

    // Start the server
    listen(port: number, callback?: () => void): void {
        Bun.serve({
            port,
            fetch: async (req) => await this.handle(req),
        });

        if (callback) callback();
    }

    // Handle incoming requests using Bun's fetch handler
    private async handle(req: Request): Promise<Response> {
        const url = new URL(req.url);  // Create a URL object to use pathname
        const method = req.method.toUpperCase() as "GET" | "POST";
        const path = url.pathname;

        // Run middlewares
        const blockedRes = await this.runMiddlewares(req);
        if (blockedRes) return blockedRes;

        // Check if the path exists in routes
        const routeHandler = this.routes[path] && this.routes[path][method];
        if (routeHandler) {
            return await routeHandler(req);
        }

        return this.handleStaticRoute(path);
    }

    private async runMiddlewares(req: Request): Promise<Response | null> {
        for (const middleware of this.middlewares) {
            let nextCalled = false;
            const next = () => { nextCalled = true; };
            const result = middleware(req, next);

            if (result instanceof Promise) {
                await result;
            }

            if (!nextCalled) {
                return new Response("Middleware blocked the request", { status: 403 });
            }
        }
        return null;
    }


    private async handleStaticRoute(path: string): Promise<Response> {
        for (const [route, dirPath] of Object.entries(this.staticRoutes)) {
            if (path.startsWith(route)) {
                const filePath = join(dirPath, path.slice(route.length));
                try {
                    return new Response(await Bun.file(filePath).arrayBuffer(), { status: 200 });
                } catch {
                    return new Response("File Not Found", { status: 404 });
                }
            }
        }
        return new Response("Not Found", { status: 404 });
    }
}
