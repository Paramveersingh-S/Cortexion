import { Aedes } from 'aedes';
import { createServer } from 'net';

async function start() {
  try {
    const broker = new Aedes();
    const server = createServer(broker.handle);
    
    server.listen(1883, function () {
      console.log('Aedes MQTT broker started on port 1883');
    });
  } catch (err) {
    console.log('Error', err);
  }
}

start();
