import { serve } from '@hono/node-server';
import app from './index.js';

const server = serve(app)
const address = server.address();
if (address && typeof address === 'object') {
    console.log(`Server is running on http://localhost:${address.port}`);
} else {
    console.log(`Server is running on ${address}`);
}

// graceful shutdown
process.on('SIGINT', () => {
    server.close()
    process.exit(0)
})
process.on('SIGTERM', () => {
    server.close((err) => {
        if (err) {
            console.error(err)
            process.exit(1)
        }
        process.exit(0)
    })
})