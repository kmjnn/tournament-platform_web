const EventEmitter = require('events');

class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  notifyUser(userId, event, data) {
    this.emit(event, { userId, data });
    if (this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  notifyAll(event, data) {
    this.emit(event, data);
    if (this.io) {
      this.io.emit(event, data);
    }
  }
}

// Singleton
const notificationService = new NotificationService();
module.exports = notificationService;