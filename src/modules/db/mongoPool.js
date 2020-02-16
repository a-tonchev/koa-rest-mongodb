import { MongoClient } from 'mongodb';
import genericPool from 'generic-pool';
import setupCollections from './setupCollections';
import setupDatabase from './setupDatabase';

let pDB;
let appDb;

function mongoPool(connOptions, confOptions = {}) {
  const mongoUrl = connOptions.uri;
  const mongoDB = connOptions.dbName;
  const genPool = genericPool.createPool({
    create: () => MongoClient.connect(mongoUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      ...confOptions,
    })
      .then(client => client)
      .catch(err => {
        throw err;
      }),
    destroy: client => client.close(),
  }, connOptions);

  async function release(resource) {
    if (resource && !resource.isConnected()) {
      await genPool.destroy(resource);
    } else {
      await genPool.release(resource);
    }
  }

  return async (ctx, next) => {
    ctx.mongo = await genPool.acquire();
    ctx.db = ctx.mongo.db(mongoDB);
    pDB = ctx.db;
    ctx.appDb = setupDatabase(ctx.db);
    appDb = ctx.appDb;
    await setupCollections(pDB);
    try {
      await next();
    } finally {
      ctx.db = null;
      ctx.appDb = null;
      await release(ctx.mongo);
    }
  };
}

const getDb = () => pDB;
const getAppDb = colName => (colName ? appDb[colName] : appDb);

export { getDb, getAppDb };
export default mongoPool;