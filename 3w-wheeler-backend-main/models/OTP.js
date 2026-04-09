import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  code: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['attendance', 'password_reset', 'login'],
    default: 'attendance'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // Document will be deleted at this time
  },
  isUsed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
