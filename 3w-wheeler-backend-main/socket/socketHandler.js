import { Server } from 'socket.io';

import Message from '../models/Message.js';
let io;

export const initializeSocket = (server) => {
  const allowedOrigins = [
    "https://servicerequests.netlify.app",
    "https://formsadmin.netlify.app",
    "https://formsuperadmin.focusengineeringapp.com",
    ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) : [])
  ];

  const developmentOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
  ];

  const allOrigins = [...allowedOrigins, ...developmentOrigins];

  io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        if (!origin) {
          return callback(null, true);
        }
        if (allOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`🚫 Socket.IO CORS blocked: ${origin}`);
          callback(null, false);
        }
      },
      credentials: true,
      methods: ["GET", "POST"],
      allowEIO3: true
    }
  });

  io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);

    // Join a specific form analytics room
    socket.on('join-form-analytics', (formId) => {
      socket.join(`form-analytics-${formId}`);
      console.log(`📊 Client ${socket.id} joined analytics room for form: ${formId}`);
    });

    // Leave a specific form analytics room
    socket.on('leave-form-analytics', (formId) => {
      socket.leave(`form-analytics-${formId}`);
      console.log(`📊 Client ${socket.id} left analytics room for form: ${formId}`);
    });

    // Join dashboard analytics room
    socket.on('join-dashboard-analytics', () => {
      socket.join('dashboard-analytics');
      console.log(`📊 Client ${socket.id} joined dashboard analytics room`);
    });

    // Leave dashboard analytics room
    socket.on('leave-dashboard-analytics', () => {
      socket.leave('dashboard-analytics');
      console.log(`📊 Client ${socket.id} left dashboard analytics room`);
    });

    // Join submission progress room
    socket.on('join-submission', (submissionId) => {
      socket.join(`submission-${submissionId}`);
      console.log(`📤 Client ${socket.id} joined submission room: ${submissionId}`);
    });

    // Leave submission progress room
    // Join personal room for private messages
    socket.on('join-chat', (userId) => {
      socket.join(`user-${userId}`);
      console.log(`💬 User ${socket.id} joined personal chat room: ${userId}`);
    });

    // Join tenant group chat room
    socket.on('join-group-chat', (tenantId) => {
      socket.join(`group-${tenantId}`);
      console.log(`💬 Client ${socket.id} joined group chat room: ${tenantId}`);
    });

    // Handle sending message
    socket.on('send-message', async (data) => {
      try {
        const { senderId, receiverId, message, tenantId, isTYC, replyTo } = data;
        
        // Save to DB
        const newMessage = await Message.create({
          senderId,
          receiverId,
          message,
          tenantId,
          isTYC: !!isTYC,
          replyTo: replyTo || null
        });

        const populatedMessage = await Message.findById(newMessage._id).populate('replyTo');

        // Emit to receiver's personal room
        io.to(`user-${receiverId}`).emit('receive-message', {
          _id: populatedMessage._id,
          senderId,
          message,
          isTYC: !!isTYC,
          replyTo: populatedMessage.replyTo,
          createdAt: populatedMessage.createdAt
        });

        // If it's a TYC, notify admins in that tenant
        if (isTYC) {
           io.to(`group-${tenantId}`).emit('tyc-raised', {
             senderId,
             message,
             createdAt: populatedMessage.createdAt
           });
        }

        // Emit back to sender (optional, but good for sync)
        socket.emit('message-sent', {
          _id: populatedMessage._id,
          status: 'sent'
        });

        console.log(`✉️ Message sent from ${senderId} to ${receiverId}`);
      } catch (error) {
        console.error('Send message socket error:', error);
        socket.emit('message-error', { error: 'Failed to send message' });
      }
    });

    // Handle group message
    socket.on('send-group-message', async (data) => {
      try {
        const { senderId, tenantId, message, isTYC, replyTo } = data;

        // Save to DB
        const newMessage = await Message.create({
          senderId,
          message,
          tenantId,
          isGroup: true,
          isTYC: !!isTYC,
          replyTo: replyTo || null
        });

        // Get populated details
        const populatedMessage = await Message.findById(newMessage._id)
          .populate('senderId', 'firstName lastName role')
          .populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'firstName lastName' }
          });

        // Emit to all users in the tenant group room
        io.to(`group-${tenantId}`).emit('receive-group-message', {
          _id: populatedMessage._id,
          senderId: populatedMessage.senderId,
          message,
          isTYC: !!isTYC,
          replyTo: populatedMessage.replyTo,
          createdAt: populatedMessage.createdAt
        });

        // Emit specially for TYC if needed
        if (isTYC) {
          io.to(`group-${tenantId}`).emit('tyc-raised', {
            senderId,
            senderName: `${populatedMessage.senderId.firstName} ${populatedMessage.senderId.lastName}`,
            message,
            createdAt: populatedMessage.createdAt
          });
        }

        console.log(`✉️ Group message sent in tenant ${tenantId} by ${senderId}`);
      } catch (error) {
        console.error('Send group message error:', error);
        socket.emit('message-error', { error: 'Failed to send group message' });
      }
    });

    // Typing indicators
    socket.on('typing', (data) => {
      const { senderId, receiverId } = data;
      io.to(`user-${receiverId}`).emit('user-typing', { senderId });
    });

    socket.on('stop-typing', (data) => {
      const { senderId, receiverId } = data;
      io.to(`user-${receiverId}`).emit('user-stop-typing', { senderId });
    });

    socket.on('leave-submission', (submissionId) => {
      socket.leave(`submission-${submissionId}`);
      console.log(`📤 Client ${socket.id} left submission room: ${submissionId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Emit events for real-time updates
export const emitResponseCreated = (formId, response) => {
  if (io) {
    // Emit to specific form analytics room
    io.to(`form-analytics-${formId}`).emit('response-created', {
      formId,
      response,
      timestamp: new Date()
    });

    // Also emit to dashboard analytics
    io.to('dashboard-analytics').emit('response-created', {
      formId,
      response,
      timestamp: new Date()
    });

    console.log(`🔔 Emitted response-created event for form: ${formId}`);
  }
};

export const emitResponseUpdated = (formId, response) => {
  if (io) {
    // Emit to specific form analytics room
    io.to(`form-analytics-${formId}`).emit('response-updated', {
      formId,
      response,
      timestamp: new Date()
    });

    // Also emit to dashboard analytics
    io.to('dashboard-analytics').emit('response-updated', {
      formId,
      response,
      timestamp: new Date()
    });

    console.log(`🔔 Emitted response-updated event for form: ${formId}`);
  }
};

export const emitResponseDeleted = (formId, responseId) => {
  if (io) {
    // Emit to specific form analytics room
    io.to(`form-analytics-${formId}`).emit('response-deleted', {
      formId,
      responseId,
      timestamp: new Date()
    });

    // Also emit to dashboard analytics
    io.to('dashboard-analytics').emit('response-deleted', {
      formId,
      responseId,
      timestamp: new Date()
    });

    console.log(`🔔 Emitted response-deleted event for form: ${formId}`);
  }
};

export const emitImageProgress = (submissionId, status) => {
  if (io) {
    io.to(`submission-${submissionId}`).emit('image-progress', {
      submissionId,
      status,
      timestamp: new Date()
    });
    console.log(`🖼️ Image progress: ${submissionId} - ${status.message}`);
  }
};