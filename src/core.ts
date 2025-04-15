import { join } from "path";
import { file } from "bun";

export type Middleware = (req: IRequest, res: Response, next: () => void) => void;

export interface IRequest extends Request {
    params?: { [key: string]: string };
}

interface RouteNode {
    children: Map<string, RouteNode>;
    paramName?: string;
    handler?: Function;
}

function createRouteTree() {
    return {
        GET: { root: new Map<string, RouteNode>() },
        POST: { root: new Map<string, RouteNode>() },
    };
}

/**
 * Represents the main Bunwork server class
 */
export default class Bunwork {
    private middlewares: Middleware[];
    private routes: ReturnType<typeof createRouteTree>;
    private staticRoutes: { [route: string]: string };

    constructor() {
        this.middlewares = [];
        this.routes = createRouteTree();
        this.staticRoutes = {};
    }

    /**
     * Adds a middleware function to the stack
     * @param fn The middleware function to add
     */
    middleware(fn: Middleware): void {
        this.middlewares.push(fn);
    }

    /**
     * Registers a GET route
     * @param path The route path
     * @param handler The handler function for the route
     */
    get(path: string, handler: Function): void {
        this.addRoute("GET", path, handler);
    }

    /**
     * Registers a POST route
     * @param path The route path
     * @param handler The handler function for the route
     */
    post(path: string, handler: Function): void {
        this.addRoute("POST", path, handler);
    }

    /**
     * Adds a route to the internal route tree
     * @param method HTTP method
     * @param path Route path
     * @param handler Route handler function
     */
    private addRoute(method: "GET" | "POST", path: string, handler: Function) {
        const parts = path.split("/").filter(Boolean);
        let current = this.routes[method].root;
        let node: RouteNode | undefined;

        for (const part of parts) {
            const key = part.startsWith(":") ? ":" : part;

            // Ensure the node is created for this part if it doesn't exist
            if (!current.has(key)) {
                const newNode: RouteNode = { children: new Map() };
                current.set(key, newNode);
                node = newNode;  // Assign newly created node
            } else {
                node = current.get(key);
            }

            if (part.startsWith(":")) {
                node!.paramName = part.slice(1); // Ensure paramName is set on the correct node
            }

            // Move to the children map for the next part of the path
            current = node!.children;
        }

        // Ensure node is not undefined before setting the handler
        if (node) {
            node.handler = handler;
        } else {
            throw new Error("Failed to add route handler. Node is undefined.");
        }
    }

    /**
     * Matches a route using the route tree
     * @param method HTTP method
     * @param path Request path
     * @returns Handler and extracted params
     */
    private matchRoute(method: "GET" | "POST", path: string) {
        const parts = path.split("/").filter(Boolean);
        let current = this.routes[method].root;
        let params: Record<string, string> = {};
        let node: RouteNode | undefined;

        for (const part of parts) {
            if (current.has(part)) {
                node = current.get(part);
            } else if (current.has(":")) {
                node = current.get(":");
                if (node?.paramName) params[node.paramName] = part;
            } else {
                return null;
            }
            current = node!.children;
        }

        if (node?.handler) {
            return { handler: node.handler, params };
        }
        return null;
    }

    /**
     * Registers a static route to serve files from a specific directory
     * @param route The route prefix for static file serving
     * @param directoryPath The directory path to serve
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
                this.addRoute(method as "GET" | "POST", path, blueprintRoutes[method as "GET" | "POST"][path].handler);
            }
        }
    }

    /**
     * Starts the server and begins listening for requests
     * @param port The port to listen on
     * @param callback Callback to run once the server starts
     */
    listen(port: number, callback?: () => void): void {
        Bun.serve({
            port,
            fetch: (req: IRequest) => this.handle(req),
        });
        if (callback) callback();
    }

    /**
     * Handles incoming requests
     * @param req The request to handle
     * @returns The response
     */
    handle(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const method = req.method.toUpperCase() as "GET" | "POST";

        const isPromise = (val: any): val is Promise<any> => {
            return val && typeof val.then === "function";
        };

        const runMiddlewares = async () => {
            for (const middleware of this.middlewares) {
                let nextCalled = false;
                const next = () => { nextCalled = true };
                const result = middleware(req as IRequest, new Response(), next);
                if (isPromise(result)) await result;
                if (!nextCalled) return new Response("Middleware blocked the request", { status: 403 });
            }
            return null;
        };

        return (async () => {
            const blockedRes = await runMiddlewares();
            if (blockedRes) return blockedRes;

            const routeHandler = this.matchRoute(method, url.pathname);

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

/**
 * Represents a blueprint for organizing related routes and middlewares
 */
export class Blueprint {
    private prefix: string;
    private routes: {
        GET: { [key: string]: { handler: Function } };
        POST: { [key: string]: { handler: Function } };
    };
    private middlewares: Middleware[];

    constructor(prefix: string) {
        this.prefix = prefix;
        this.routes = { GET: {}, POST: {} };
        this.middlewares = [];
    }

    /**
     * Adds a middleware function to the blueprint
     * @param fn Middleware function
     */
    middleware(fn: Middleware): void {
        this.middlewares.push(fn);
    }

    /**
     * Registers a GET route in the blueprint
     * @param path Relative path
     * @param handler Route handler
     */
    get(path: string, handler: Function): void {
        this.routes.GET[`${this.prefix}${path}`] = { handler };
    }

    /**
     * Registers a POST route in the blueprint
     * @param path Relative path
     * @param handler Route handler
     */
    post(path: string, handler: Function): void {
        this.routes.POST[`${this.prefix}${path}`] = { handler };
    }

    /**
     * Retrieves all blueprint routes
     * @returns Route map
     */
    getRoutes() {
        return this.routes;
    }

    /**
     * Retrieves all blueprint middlewares
     * @returns Middleware array
     */
    getMiddlewares() {
        return this.middlewares;
    }
}
