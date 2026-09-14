import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
export function sqliteBinding(filename=':memory:') {
  const sqlite=new DatabaseSync(filename);
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for(const name of fs.readdirSync('drizzle').filter(n=>n.endsWith('.sql')).sort()) {
    if(sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;
    sqlite.exec(fs.readFileSync('drizzle/'+name,'utf8'));
    sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);
  }
  const binding={
    prepare(sql){const statement=sqlite.prepare(sql);let args=[];
      return {bind(...values){args=values;return this;},
        async first(){return statement.get(...args)||null;},
        async all(){return {results:statement.all(...args)};},
        async run(){const r=statement.run(...args);return {meta:{changes:Number(r.changes)}};},
      };
    },
    async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const rows=[];for(const statement of statements)rows.push(await statement.run());sqlite.exec('COMMIT');return rows;}catch(e){sqlite.exec('ROLLBACK');throw e;}},
    close(){sqlite.close();},
  };return binding;
}
