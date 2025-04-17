import Bunwork from '../../dist'

const app = new Bunwork();

app.get('/', async () => {
    return new Response("OK")
})

app.listen(3000)