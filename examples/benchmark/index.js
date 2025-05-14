import Bunwork from 'bunwork'

const app = new Bunwork();

app.get('/', async () => {
    return new Response("OK")
})

app.listen(5000)