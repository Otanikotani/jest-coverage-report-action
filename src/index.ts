import { run } from './run';

run().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
