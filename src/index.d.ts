declare module 'bunwork' {
    export default class Bunwork {
        middleware(fn: (req: Request, res: Response, next: () => void) => void): void;
        get(path: string, handler: (req: Request) => Response | Promise<Response>): void;
        post(path: string, handler: (req: Request) => Response | Promise<Response>): void;
        static(route: string, directoryPath: string): void;
        registerBlueprint(blueprint: Blueprint): void;
        listen(port: number, callback?: () => void): void;
    }

    export class Blueprint {
        constructor(prefix: string);
        middleware(fn: (req: Request, res: Response, next: () => void) => void): void;
        get(path: string, handler: (req: Request) => Response | Promise<Response>): void;
        post(path: string, handler: (req: Request) => Response | Promise<Response>): void;
    }
}
