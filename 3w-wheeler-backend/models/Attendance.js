import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  inspector: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },
  shiftName: String,
  shiftStartTime: String,
  shiftEndTime: String,
  date: {
    type: Date,
    required: true
  },
  checkInTime: {
    type: Date
  },
  checkInLat: Number,
  checkInLng: Number,
  checkInPlace: String,
  checkInAccuracy: Number,
  checkOutTime: {
    type: Date
  },
  checkOutLat: Number,
  checkOutLng: Number,
  checkOutPlace: String,
  checkOutAccuracy: Number,
  isLate: {
    type: Boolean,
    default: false
  },
  isEarlyCheckout: {
    type: Boolean,
    default: false
  },
  isHalfDay: {
    type: Boolean,
    default: false
  },
  workingHours: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['present', 'late', 'half-day', 'absent'],
    default: 'present'
  },
  sessions: [{
    checkInTime: Date,
    checkInLat: Number,
    checkInLng: Number,
    checkInPlace: String,
    checkInAccuracy: Number,
    checkOutTime: Date,
    checkOutLat: Number,
    checkOutLng: Number,
    checkOutPlace: String,
    checkOutAccuracy: Number,
    workingHours: {
      type: Number,
      default: 0
    }
  }],
  notes: String
}, {
  timestamps: true
});

// Pre-save hook to calculate working hours
attendanceSchema.pre('save', function(next) {
  if (this.sessions && this.sessions.length > 0) {
    let totalHours = 0;
    this.sessions.forEach(session => {
      if (session.checkInTime && session.checkOutTime) {
        session.workingHours = (session.checkOutTime - session.checkInTime) / (1000 * 60 * 60);
        session.workingHours = Math.round(session.workingHours * 100) / 100;
        totalHours += session.workingHours;
      }
    });
    this.workingHours = Math.round(totalHours * 100) / 100;
  } else if (this.checkInTime && this.checkOutTime) {
    this.workingHours = (this.checkOutTime - this.checkInTime) / (1000 * 60 * 60);
    this.workingHours = Math.round(this.workingHours * 100) / 100;
  }
  next();
});

// Indexes
attendanceSchema.index({ inspector: 1, date: 1 }, { unique: true });
attendanceSchema.index({ tenantId: 1, date: 1 });
attendanceSchema.index({ shift: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
