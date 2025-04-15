import { describe, expect, it } from "bun:test";
import Bunwork, { type IRequest } from "./../src";

async function appTestFetch(app: Bunwork, req: Request): Promise<Response> {
	return await app.handle(req);
}

describe("Bunwork", () => {
	it("should register a GET route and handle a request", async () => {
		const app = new Bunwork();

		app.get("/hello", () => new Response("world"));

		const req = new Request("http://localhost/hello", { method: "GET" });
		const res = await appTestFetch(app, req);

		expect(await res.text()).toBe("world");
		expect(res.status).toBe(200);
	});

	it("should handle dynamic route with params", async () => {
		const app = new Bunwork();

		app.get("/user/:id", (req: IRequest) => {
			return new Response(`User ID: ${req.params?.id}`);
		});

		const req = new Request("http://localhost/user/123", { method: "GET" });
		const res = await appTestFetch(app, req);

		expect(await res.text()).toBe("User ID: 123");
	});
});
