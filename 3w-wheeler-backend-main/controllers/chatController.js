import Message from '../models/Message.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const getMessages = async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: contactId },
        { senderId: contactId, receiverId: userId }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(100);

    // Mark messages from contactId to me as read
    await Message.updateMany(
      { senderId: contactId, receiverId: userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getContacts = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;
    let query = { ...req.tenantFilter };

    // Super Admin: Can contact anyone
    // Admin: Can contact anyone in their tenant
    // User/Teacher: Can contact their Admin or Super Admin
    if (userRole === 'superadmin') {
      query = { role: { $ne: 'superadmin' }, _id: { $ne: userId } };
    } else if (userRole === 'admin') {
      // Find both tenants users AND super admins
      query = {
        $or: [
          { tenantId: tenantId, _id: { $ne: userId } },
          { role: 'superadmin' }
        ]
      };
    } else {
      // User/Teacher level: Contact Admin or Super Admin
      query = {
        $or: [
          { tenantId: tenantId, role: 'admin' },
          { role: 'superadmin' }
        ]
      };
    }

    const contacts = await User.find(query)
      .select('firstName lastName username role email mobile')
      .sort({ firstName: 1 });

    res.json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getRecentConversations = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", userId] },
              "$receiverId",
              "$senderId"
            ]
          },
          lastMessage: { $first: "$message" },
          createdAt: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiverId", userId] }, { $eq: ["$read", false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          createdAt: 1,
          unreadCount: 1,
          user: {
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            username: '$user.username',
            role: '$user.role'
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get recent conversations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
