import { io, Socket } from "socket.io-client";
import { API_BASE } from "@/lib/api";

let socket: Socket | null = null;

export function initializeSocket(token: string): Socket {
  if (socket) {
    return socket;
  }

  socket = io(API_BASE || "/", {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket?.id);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Order events
export function onOrderStatusUpdate(callback: (data: any) => void) {
  if (socket) {
    socket.on("orderStatusUpdate", callback);
  }
  return () => {
    if (socket) {
      socket.off("orderStatusUpdate", callback);
    }
  };
}

// Rider assignment events
export function onRiderAssigned(callback: (data: any) => void) {
  if (socket) {
    socket.on("riderAssigned", callback);
  }
  return () => {
    if (socket) {
      socket.off("riderAssigned", callback);
    }
  };
}

// Notify new order available
export function emitNewOrderAvailable(order: any) {
  if (socket) {
    socket.emit("newOrderAvailable", order);
  }
}

// Notify rider went online
export function emitRiderOnline(riderId: string) {
  if (socket) {
    socket.emit("riderOnline", { riderId });
  }
}
