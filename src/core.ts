import { join } from "path";
import { file } from "bun";

/**
 * Creates the initial route tree structure with GET and POST methods.
 * @returns A route tree structure for GET and POST methods.
 */
function createRouteTree() {
    return {
        GET: { root: new Map<string, RouteNode>() },
        POST: { root: new Map<string, RouteNode>() },
    };
}

/**
 * Represents a single route node in the route tree.
 */
interface RouteNode {
    children: Map<string, RouteNode>;
    paramName?: string;
    handler?: Function;
}

/**
 * Represents the main Bunwork server class.
 * Handles route registration, middleware, and request handling.
 */
export default class Bunwork {
    middlewares: Middleware[];
    routes: ReturnType<typeof createRouteTree>;
    staticRoutes: { [route: string]: string };

    /**
     * Initializes a new instance of the Bunwork server.
     * Sets up empty middlewares, routes, and static routes.
     */
    constructor() {
        this.middlewares = [];
        this.routes = createRouteTree();
        this.staticRoutes = {};
    }

    /**
     * Adds a middleware function to the middleware stack.
     * @param fn The middleware function to add.
     */
    middleware(fn: Middleware): void {
        this.middlewares.push(fn);
    }

    /**
     * Registers a GET route.
     * @param path The route path to register.
     * @param handler The handler function to execute for this route.
     */
    get(path: string, handler: Handler): void {
        this.addRoute("GET", path, handler);
    }

    /**
     * Registers a POST route.
     * @param path The route path to register.
     * @param handler The handler function to execute for this route.
     */
    post(path: string, handler: Handler): void {
        this.addRoute("POST", path, handler);
    }

    /**
     * Adds a route to the internal route tree.
     * @param method The HTTP method (GET/POST).
     * @param path The route path to register.
     * @param handler The handler function for this route.
     */
    private addRoute(method: "GET" | "POST", path: string, handler: Function): void {
        if (path === "/") {
            this.routes[method].root.set("/", { children: new Map(), handler });
            return;
        }

        const parts = path.split("/").filter(Boolean);
        let current = this.routes[method].root;
        let node: RouteNode | undefined;

        for (const part of parts) {
            const key = part.startsWith(":") ? ":" : part;

            if (!current.has(key)) {
                const newNode: RouteNode = { children: new Map() };
                current.set(key, newNode);
                node = newNode;
            } else {
                node = current.get(key);
            }

            if (part.startsWith(":")) {
                node!.paramName = part.slice(1);
            }

            current = node!.children;
        }

        if (node) {
            node.handler = handler;
        } else {
            throw new Error("Failed to add route handler. Node is undefined.");
        }
    }


    /**
     * Matches a route from the route tree based on the request path and HTTP method.
     * @param method The HTTP method (GET/POST).
     * @param path The request path to match.
     * @returns The handler function and extracted parameters if a match is found; otherwise, null.
     */
    private matchRoute(method: "GET" | "POST", path: string) {
        const parts = path === "/" ? [] : path.split("/").filter(Boolean);
        let current = this.routes[method].root;
        let params: Record<string, string> = {};
        let node: RouteNode | undefined;

        for (const part of parts) {
            if (current.has(part)) {
                node = current.get(part)!;
            } else if (current.has(":")) {
                node = current.get(":")!;
                if (node.paramName) params[node.paramName] = part;
            } else {
                return null;
            }
            current = node.children;
        }

        node ??= current.get("/"); // fallback for root if no parts

        if (node?.handler) {
            return { handler: node.handler, params };
        }

        return null;
    }



    /**
     * Registers a static route to serve files from a specific directory.
     * @param route The route prefix to use for static file serving.
     * @param directoryPath The directory path from which to serve files.
     */
    static(route: string, directoryPath: string): void {
        this.staticRoutes[route] = directoryPath;
    }

    /**
     * Registers blueprint routes and middlewares.
     * @param blueprint The blueprint instance containing routes and middlewares.
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
     * Starts the server and begins listening for requests on the specified port.
     * @param port The port to listen on.
     * @param callback A callback to run once the server starts.
     */
    listen(port: number, callback?: () => void): void {
        Bun.serve({
            port,
            fetch: (req: Request) => this.handle(req),
        });
        if (callback) callback();
    }

    /**
     * Handles incoming HTTP requests and processes them.
     * @param req The incoming request to handle.
     * @returns The HTTP response.
     */
    async handle(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const method = req.method.toUpperCase() as "GET" | "POST";

        const isPromise = (val: any): val is Promise<any> => {
            return val && typeof val.then === "function";
        };

        const runMiddlewares = async () => {
            for (const middleware of this.middlewares) {
                let nextCalled = false;
                const next = () => { nextCalled = true; };
                const result = middleware(req as IRequest, new Response(), next);
                if (isPromise(result)) await result;
                if (!nextCalled) return new Response("Middleware blocked the request", { status: 403 });
            }
            return null;
        };

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
    }
}

/**
 * Represents a blueprint for organizing related routes and middlewares.
 */
export class Blueprint {
    prefix: string;
    routes: {
        GET: { [key: string]: { handler: Function } };
        POST: { [key: string]: { handler: Function } };
    };
    middlewares: Middleware[];

    /**
     * Creates a new blueprint instance with a specified prefix.
     * @param prefix The route prefix for this blueprint.
     */
    constructor(prefix: string) {
        this.prefix = prefix;
        this.routes = { GET: {}, POST: {} };
        this.middlewares = [];
    }

    /**
     * Adds a middleware function to the blueprint.
     * @param fn The middleware function to add.
     */
    middleware(fn: Middleware): void {
        this.middlewares.push(fn);
    }

    /**
     * Registers a GET route in the blueprint.
     * @param path The relative path for the route.
     * @param handler The handler function for the route.
     */
    get(path: string, handler: Function): void {
        this.routes.GET[`${this.prefix}${path}`] = { handler };
    }

    /**
     * Registers a POST route in the blueprint.
     * @param path The relative path for the route.
     * @param handler The handler function for the route.
     */
    post(path: string, handler: Function): void {
        this.routes.POST[`${this.prefix}${path}`] = { handler };
    }

    /**
     * Retrieves all routes registered in the blueprint.
     * @returns The route map for both GET and POST methods.
     */
    getRoutes() {
        return this.routes;
    }

    /**
     * Retrieves all middlewares registered in the blueprint.
     * @returns The middleware array.
     */
    getMiddlewares() {
        return this.middlewares;
    }
}

/**
 * Defines a middleware function type.
 * @param req The incoming request.
 * @param res The response object.
 * @param next A function to call the next middleware.
 */
export type Middleware = (req: IRequest, res: Response, next: () => void) => void;

/**
 * Extends the standard Request interface with optional parameters.
 */
export interface IRequest extends Request {
    params?: { [key: string]: string };
}

export type Handler = (req: IRequest) => Response | Promise<Response>;
