const EventEmitter = require("events");

class RoomUpEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
  }

  // Safe emit that catches async errors in listeners
  async emitAsync(event, ...args) {
    const listeners = this.rawListeners(event);
    for (const listener of listeners) {
      try {
        await listener(...args);
      } catch (err) {
        console.error(`[EventBus Error] Event '${event}':`, err.message);
      }
    }
  }
}

const eventBus = new RoomUpEventBus();
eventBus.eventBus = eventBus;
module.exports = eventBus;
