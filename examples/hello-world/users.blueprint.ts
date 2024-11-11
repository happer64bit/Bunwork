import { Blueprint } from "../../src";

const users = [
    {
        id: 1,
        name: "Alex"
    },
    {
        id: 2,
        name: "John"
    },
    {
        id: 3,
        name: "Happer"
    }
]

const UsersBlueprint = new Blueprint("/users")

UsersBlueprint.middleware((req, _, next) => {
    if(req.headers["Authorization"]) return new Response("No Authorization Header Allowed", {
        status: 403
    })

    next()
})

UsersBlueprint.get("/:id", (req) => {
    const url = new URL(req.url);
    const id = url.pathname.split('/')[2];

    return Response.json(users.find((val) => val.id == parseInt(id)) ?? {})
})

export default UsersBlueprint;
