import knex from 'knex';
// @ts-ignore
import knexConfig from '../../../knexfile';

const db = knex(knexConfig.development);

export default db;    