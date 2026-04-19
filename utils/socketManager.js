let ioInstance = null;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => {
  if (!ioInstance) {
    console.warn('Socket.io not initialized yet');
  }
  return ioInstance;
};
