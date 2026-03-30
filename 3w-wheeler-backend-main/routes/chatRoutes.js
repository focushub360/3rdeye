import express from 'express';
import { getMessages, getContacts, getRecentConversations } from '../controllers/chatController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/conversations', getRecentConversations);
router.get('/contacts', getContacts);
router.get('/messages/:contactId', getMessages);

export default router;
