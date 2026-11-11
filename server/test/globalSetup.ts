import { execFileSync } from 'node:child_process';

// Runs once before the suite: make sure jobtracker_test exists and has a fresh copy of schema.sql
export default function setup() {
  const exists = execFileSync('psql', ['postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'jobtracker_test'"]).toString().trim();
  if (exists !== '1') {
    execFileSync('psql', ['postgres', '-c', 'CREATE DATABASE jobtracker_test']);
  }
  execFileSync('psql', ['jobtracker_test', '-q', '-v', 'ON_ERROR_STOP=1', '-f', 'schema.sql'], { stdio: 'ignore' });
}
