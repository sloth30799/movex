import * as http from 'http';
import { Server as SocketServer } from 'socket.io';
import { LocalMovexStore, MovexStore } from 'libs/movex/src/lib/movex-store';
import { SocketIOEmitter, objectKeys } from 'movex-core-util';
import {
  MovexMasterResource,
  initMovexMaster,
} from 'libs/movex/src/lib/master';
import { Master, MovexDefinition } from 'movex';
import { IOEvents } from 'libs/movex/src/lib/io-connection/io-events';
import express from 'express';
import cors from 'cors';

export const movexServer = (
  {
    httpServer = http.createServer(),
    corsOpts,
    movexStore = 'memory',
  }: {
    httpServer?: http.Server;
    corsOpts?: cors.CorsOptions;
    movexStore?: 'memory' | MovexStore<any, any>; // | 'redis' once it's implemented
  },
  definition: MovexDefinition
) => {
  const app = express();

  // this is specifx?
  app.use(cors(corsOpts));

  app.get('/', (_, res) => {
    res.send({ message: `Welcome to Movex!` });
  });

  httpServer.on('request', app);

  const socket = new SocketServer(httpServer, {
    cors: {
      origin: corsOpts?.origin || '*',
    },
  });

  const movexMaster = Master.initMovexMaster(definition, movexStore);

  const getClientId = (clientId: string) =>
    clientId || String(Math.random()).slice(-5);

  socket.on('connection', (io) => {
    const clientId = getClientId(io.handshake.query['clientId'] as string);
    console.log('[MovexServer] Client Connected', clientId);

    const connection = new Master.ConnectionToClient(
      clientId,
      new SocketIOEmitter<IOEvents>(io)
    );

    io.emit('$setClientId', clientId);

    movexMaster.addClientConnection(connection);

    io.on('disconnect', () => {
      console.log('[MovexServer] Client Disconnected', clientId);

      movexMaster.removeConnection(clientId);
    });
  });

  // //start our server
  const port = process.env['port'] || 3333;
  httpServer.listen(port, () => {
    const address = httpServer.address();

    if (typeof address !== 'string') {
      console.info(`Movex Server started on port ${address?.port}`);
    }
  });
};
