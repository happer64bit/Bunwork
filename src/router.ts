import type Bunwork from './';
import type { Middleware, Handler } from './';

export default class Router {
    private routes: { [route: string]: { [method: string]: Handler } } = {};
    private middlewares: Middleware[] = [];

    use(middleware: Middleware): void {
        this.middlewares.push(middleware);
    }

    get(path: string, handler: Handler): void {
        this.addRoute("GET", path, handler);
    }

    post(path: string, handler: Handler): void {
        this.addRoute("POST", path, handler);
    }

    private addRoute(method: "GET" | "POST", path: string, handler: Handler): void {
        if (!this.routes[path]) {
            this.routes[path] = {};
        }
        this.routes[path][method] = handler;
    }

    applyTo(app: Bunwork): void {
        for (const path in this.routes) {
            for (const method in this.routes[path]) {
                if (method === "GET") {
                    app.get(path, this.routes[path][method]);
                } else if (method === "POST") {
                    app.post(path, this.routes[path][method]);
                }
            }
        }

        for (const mw of this.middlewares) {
            app.middleware(mw);
        }
    }
}
