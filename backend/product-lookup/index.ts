import {createProductLookup} from './search.mjs';
// Public product data only. JWT verification remains enabled at the gateway.
// No database connection, credentials, account data or write operation.
Deno.serve(createProductLookup());
