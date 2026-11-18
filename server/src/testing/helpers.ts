import type request from 'supertest';

// "Send this request as user A / user B": the fake login in setup.ts reads this header.
export const asA = (r: request.Test) => r.set('x-test-user', 'user_A');
export const asB = (r: request.Test) => r.set('x-test-user', 'user_B');
