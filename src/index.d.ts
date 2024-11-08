declare class Bunwork {
    private middlewares: Array<(req: Request, res: Response, next: () => void) => void>;
    private routes: {
        [method: string]: { [path: string]: { handler: (req: Request) => Response | Promise<Response>, isDynamic: boolean } }
    };

    constructor();

    // Adds a middleware function to be executed for all requests
    middleware(fn: (req: Request, res: Response, next: () => void) => void): void;

    // Registers a GET route
    get(path: string, handler: (req: Request) => Response | Promise<Response>): void;

    // Registers a POST route
    post(path: string, handler: (req: Request) => Response | Promise<Response>): void;

    // Registers a Blueprint (collection of routes and middlewares)
    registerBlueprint(blueprint: Blueprint): void;

    // Starts the server on the given port
    listen(port: number, callback?: () => void): void;

    // Helper method to match and handle dynamic route parameters
    private matchRoute(path: string, method: string): { handler: (req: Request) => Response | Promise<Response>, params?: { [key: string]: string } } | null;

    // Helper method to create regex from dynamic routes
    private buildRouteRegex(path: string): RegExp;

    // Helper method to extract parameters from dynamic route matches
    private extractParams(routePath: string, match: RegExpMatchArray): { [key: string]: string };
}

declare class Blueprint {
    private prefix: string;
    private routes: {
        [method: string]: { [path: string]: { handler: (req: Request) => Response | Promise<Response>, isDynamic: boolean } }
    };
    private middlewares: Array<(req: Request, res: Response, next: () => void) => void>;

    constructor(prefix: string);

    // Adds a middleware function to be executed for all requests in the blueprint
    middleware(fn: (req: Request, res: Response, next: () => void) => void): void;

    // Registers a GET route for this blueprint
    get(path: string, handler: (req: Request) => Response | Promise<Response>): void;

    // Registers a POST route for this blueprint
    post(path: string, handler: (req: Request) => Response | Promise<Response>): void;

    // Retrieves the blueprint's routes
    getRoutes(): { [method: string]: { [path: string]: { handler: (req: Request) => Response | Promise<Response>, isDynamic: boolean } } };

    // Retrieves the blueprint's middlewares
    getMiddlewares(): Array<(req: Request, res: Response, next: () => void) => void>;

    // Helper method to check if a route has dynamic segments (e.g., :param)
    private isDynamicRoute(path: string): boolean;
}

export default Bunwork;
export { Blueprint };
