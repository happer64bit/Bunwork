import { Blueprint } from "bunwork";

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

UsersBlueprint.get("/:id", (req) => {
    const { id } = req.params
    return Response.json(users.find((val) => val.id == parseInt(id)) ?? {})
})

export default UsersBlueprint;
