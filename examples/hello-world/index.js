import Bunwork from "bunwork";
import UsersBlueprint from './users.blueprint'

const app = new Bunwork();

// Apply the logger middleware globally
app.static("/", "./public")

// GET route for "/"
app.get('/', async (req) => {
    const url = new URL(req.url); // Parse the URL to extract query parameters
    const name = url.searchParams.get('name') || 'World'; // Retrieve the "name" query parameter or default to "World"
    
    return new Response(`Hello, ${name}!`, { status: 200 });
});

// Example route with query parameters (e.g., "/greet?name=John&age=30")
app.get('/greet', async (req) => {
    const url = new URL(req.url); // Parse the URL to extract query parameters
    const name = url.searchParams.get('name') || 'Guest'; // Default to "Guest" if no "name" query parameter
    const age = url.searchParams.get('age') || 'unknown'; // Default to "unknown" if no "age" query parameter
    
    return new Response(`Hello, ${name}! You are ${age} years old.`, { status: 200 });
});

app.registerBlueprint(UsersBlueprint)

app.listen(3000);
