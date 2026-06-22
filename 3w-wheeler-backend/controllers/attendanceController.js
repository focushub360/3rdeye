import Attendance from '../models/Attendance.js';
import Shift from '../models/Shift.js';
import User from '../models/User.js';
import { reverseGeocode } from '../utils/geocode.js';
import mongoose from 'mongoose';
import XLSX from 'xlsx';
import smsService from '../services/smsService.js';

// Timezone-independent IST helper functions
const getISTNow = (customDate) => {
  // Return the actual unshifted Date object representing the correct instant of time
  return customDate ? new Date(customDate) : new Date();
};

const getISTToday = (customDate) => {
  const date = customDate ? new Date(customDate) : new Date();
  // Shift by 5.5 hours to represent the calendar day in IST
  const temp = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = temp.getUTCFullYear();
  const month = temp.getUTCMonth();
  const day = temp.getUTCDate();
  // Return Date representing UTC midnight of that IST calendar day
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
};

const getISTDate = getISTToday;

// Helper to get IST hours and minutes timezone-independently
const getISTHoursAndMinutes = (date) => {
  const temp = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return {
    hours: temp.getUTCHours(),
    minutes: temp.getUTCMinutes()
  };
};

// Helper to format Date into IST time string timezone-independently
const formatISTTime = (date) => {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });
};

// Helper to convert HH:mm to minutes
const toMins = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Centered Shift Detection Logic with Buffer
 */
const findShiftByTime = (currentMins, shifts, bufferMins = 15) => {
  console.log(`findShiftByTime - currentMins: ${currentMins}, shiftsCount: ${shifts.length}, buffer: ${bufferMins}`);
  
  return shifts.find(s => {
    const startMins = toMins(s.startTime);
    const endMins = toMins(s.endTime);
    const isNight = s.isNightShift || startMins > endMins;

    // Buffer allows checking in slightly before the shift starts
    const bufferedStart = (startMins - bufferMins + 1440) % 1440;
    
    let isMatch = false;
    if (isNight) {
      if (bufferedStart > endMins) {
        isMatch = currentMins >= bufferedStart || currentMins < endMins;
      } else {
        isMatch = currentMins >= bufferedStart && currentMins < endMins;
      }
    } else {
      if (bufferedStart > endMins) {
        isMatch = currentMins >= bufferedStart || currentMins < endMins;
      } else {
        isMatch = currentMins >= bufferedStart && currentMins < endMins;
      }
    }

    console.log(`Checking shift ${s.displayName || s.name} (${s.startTime}-${s.endTime}): bufferedStart=${bufferedStart}, endMins=${endMins}, isNight=${isNight} -> Match: ${isMatch}`);
    return isMatch;
  });
};

/**
 * Check-in process for inspectors (HRM Logic)
 */
export const checkIn = async (req, res) => {
  try {
    const { lat, lng, accuracy, otp, offlineTime } = req.body;
    const inspectorId = req.user._id;
    const tenantId = req.user.tenantId;
    
    // Verify OTP if provided
    if (otp) {
      const user = await User.findById(inspectorId);
      if (user.attendanceOTP !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }
      // Clear OTP after use
      user.attendanceOTP = null;
      user.attendanceOTPVerified = true;
      await user.save();
    }

    // 2. Setup IST boundaries
    const now = getISTNow(offlineTime);
    const today = getISTToday(offlineTime);

    // 2.5 Auto Shift Detection
    const allShifts = await Shift.find({ tenantId, isActive: true });
    const { hours, minutes } = getISTHoursAndMinutes(now);
    const currentMins = hours * 60 + minutes;

    const shift = findShiftByTime(currentMins, allShifts, 15); // 15 mins buffer

    if (!shift) {
      return res.status(400).json({ 
        success: false, 
        message: 'No shift available for current time. Contact admin.' 
      });
    }

    // 3. Validate timing against shift (Late/Half-day marking)
    const shiftStartMins = toMins(shift.startTime);
    const shiftEndMins = toMins(shift.endTime);
    let status = 'present';
    let isLate = false;
    let isHalfDay = false;

    // Calculate diff for status marking
    let diff;
    if (shift.isNightShift || shiftStartMins > shiftEndMins) {
      if (currentMins >= shiftStartMins) {
        diff = currentMins - shiftStartMins;
      } else if (currentMins < shiftEndMins) {
        // Checked in after midnight
        diff = currentMins + (1440 - shiftStartMins);
      } else {
        // Within the buffer before start (e.g. 21:50 for 22:00 start)
        diff = currentMins - shiftStartMins;
      }
    } else {
      diff = currentMins - shiftStartMins;
    }

    if (diff > shift.halfDayMarkingAfter) {
      status = 'half-day';
      isHalfDay = true;
    } else if (diff > shift.lateMarkingAfter) {
      status = 'late';
      isLate = true;
    }

    const place = await reverseGeocode(lat, lng);

    // 4. Check for existing attendance today
    let existingAttendance = await Attendance.findOne({
      inspector: inspectorId,
      date: { $gte: today }
    });

    if (existingAttendance && existingAttendance.checkInTime) {
      // Migrate legacy sessions if empty
      if (!existingAttendance.sessions || existingAttendance.sessions.length === 0) {
        existingAttendance.sessions = [{
          checkInTime: existingAttendance.checkInTime,
          checkInLat: existingAttendance.checkInLat,
          checkInLng: existingAttendance.checkInLng,
          checkInPlace: existingAttendance.checkInPlace,
          checkInAccuracy: existingAttendance.checkInAccuracy,
          checkOutTime: existingAttendance.checkOutTime,
          checkOutLat: existingAttendance.checkOutLat,
          checkOutLng: existingAttendance.checkOutLng,
          checkOutPlace: existingAttendance.checkOutPlace,
          checkOutAccuracy: existingAttendance.checkOutAccuracy,
          workingHours: existingAttendance.workingHours || 0
        }];
      }

      // Check if last session is still checked in
      const lastSession = existingAttendance.sessions[existingAttendance.sessions.length - 1];
      if (lastSession && !lastSession.checkOutTime) {
        return res.status(400).json({ success: false, message: 'Already checked in. Please check out first.' });
      }

      // Check check-in limit
      if (existingAttendance.sessions.length >= 3) {
        return res.status(400).json({ success: false, message: 'Maximum limit of 3 check-ins per day reached' });
      }

      // Allow 2nd or 3rd session check-in
      existingAttendance.sessions.push({
        checkInTime: now,
        checkInLat: lat,
        checkInLng: lng,
        checkInPlace: place || 'Position Captured',
        checkInAccuracy: accuracy
      });

      existingAttendance.checkInTime = now;
      existingAttendance.checkInLat = lat;
      existingAttendance.checkInLng = lng;
      existingAttendance.checkInPlace = place || 'Position Captured';
      existingAttendance.checkInAccuracy = accuracy;
      
      existingAttendance.checkOutTime = null;
      existingAttendance.checkOutLat = null;
      existingAttendance.checkOutLng = null;
      existingAttendance.checkOutPlace = null;
      existingAttendance.checkOutAccuracy = null;
      
      if (isLate) existingAttendance.isLate = true;

      existingAttendance.notes = `Session ${existingAttendance.sessions.length} check-in: ${formatISTTime(now)}. ${existingAttendance.notes || ''}`;
      
      await existingAttendance.save();
      console.log(`checkIn - registered session ${existingAttendance.sessions.length}:`, existingAttendance);
      return res.status(201).json({ success: true, data: existingAttendance });
    }

    const attendanceData = {
      inspector: inspectorId,
      tenantId,
      shift: shift._id,
      shiftName: shift.displayName,
      shiftStartTime: shift.startTime,
      shiftEndTime: shift.endTime,
      date: today,
      checkInTime: now,
      checkInLat: lat,
      checkInLng: lng,
      checkInPlace: place || 'Position Captured',
      checkInAccuracy: accuracy,
      status,
      isLate,
      isHalfDay,
      sessions: [{
        checkInTime: now,
        checkInLat: lat,
        checkInLng: lng,
        checkInPlace: place || 'Position Captured',
        checkInAccuracy: accuracy
      }]
    };

    console.log('checkIn - creating new attendance:', attendanceData);

    if (existingAttendance) {
      // In case an empty/absent record was created by admin
      Object.assign(existingAttendance, attendanceData);
      await existingAttendance.save();
      console.log('checkIn - updated existing empty attendance:', existingAttendance);
    } else {
      existingAttendance = await Attendance.create(attendanceData);
      console.log('checkIn - created new attendance:', existingAttendance);
    }

    res.status(201).json({ success: true, data: existingAttendance });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check-out process for inspectors (HRM Logic)
 */
export const checkOut = async (req, res) => {
  try {
    const { lat, lng, accuracy, offlineTime } = req.body;
    const inspectorId = req.user._id;
    const tenantId = req.user.tenantId;
    const now = getISTNow(offlineTime);
    const today = getISTToday(offlineTime);

    const place = await reverseGeocode(lat, lng);

    let attendance = await Attendance.findOne({
      inspector: inspectorId,
      date: { $gte: today },
      checkInTime: { $exists: true },
      checkOutTime: null
    }).populate('shift');

    if (!attendance) {
      // Offline fallback: Auto-create check-in if none exists, or populate empty check-in
      attendance = await Attendance.findOne({
        inspector: inspectorId,
        date: { $gte: today }
      }).populate('shift');

      if (!attendance) {
        // Auto-detect shift
        const allShifts = await Shift.find({ tenantId, isActive: true });
        const { hours: checkoutHours, minutes: checkoutMinutes } = getISTHoursAndMinutes(now);
        const currentMins = checkoutHours * 60 + checkoutMinutes;
        
        let shift = findShiftByTime(currentMins, allShifts, 15);
        if (!shift && allShifts.length > 0) {
          shift = allShifts[0]; // Fallback to first shift if none matching
        }

        if (!shift) {
          // Check if there is any shift in the DB for this tenant (even inactive)
          let existingShift = await Shift.findOne({ tenantId });
          if (!existingShift) {
            // Create a default normal shift for this tenant
            existingShift = await Shift.create({
              name: 'Normal',
              displayName: 'Normal',
              startTime: '09:00',
              endTime: '18:00',
              gracePeriod: 15,
              lateMarkingAfter: 30,
              halfDayMarkingAfter: 120,
              isActive: true,
              tenantId: tenantId,
              createdBy: inspectorId
            });
            console.log(`[OfflineQueue Fix] Auto-created default normal shift for tenant ${tenantId}`);
          }
          shift = existingShift;
        }

        if (!shift) {
          return res.status(400).json({ success: false, message: 'No active check-in found for today, and failed to configure a default shift.' });
        }

        // Auto-create check-in at shift start time
        const shiftStartStr = shift.startTime || '09:00';
        const [sh, sm] = shiftStartStr.split(':').map(Number);
        const checkInTime = new Date(today.getTime());
        const startTotalMins = sh * 60 + sm - 330;
        checkInTime.setUTCMinutes(startTotalMins);

        const checkInPlace = place || 'Position Captured';

        attendance = new Attendance({
          inspector: inspectorId,
          tenantId,
          shift: shift._id,
          shiftName: shift.displayName,
          shiftStartTime: shift.startTime,
          shiftEndTime: shift.endTime,
          date: today,
          checkInTime: checkInTime,
          checkInLat: lat,
          checkInLng: lng,
          checkInPlace: checkInPlace,
          checkInAccuracy: accuracy,
          status: 'present',
          sessions: [{
            checkInTime: checkInTime,
            checkInLat: lat,
            checkInLng: lng,
            checkInPlace: checkInPlace,
            checkInAccuracy: accuracy
          }]
        });
        await attendance.save();
        console.log('[OfflineQueue Fix] Auto-created check-in during check-out sync:', attendance);
      } else if (!attendance.checkInTime) {
        // Populate missing check-in fields in empty/absent record
        const shiftStartStr = attendance.shiftStartTime || attendance.shift?.startTime || '09:00';
        const [sh, sm] = shiftStartStr.split(':').map(Number);
        const checkInTime = new Date(today.getTime());
        const startTotalMins = sh * 60 + sm - 330;
        checkInTime.setUTCMinutes(startTotalMins);

        attendance.checkInTime = checkInTime;
        attendance.checkInLat = lat;
        attendance.checkInLng = lng;
        attendance.checkInPlace = place || 'Position Captured';
        attendance.checkInAccuracy = accuracy;
        attendance.status = 'present';
        attendance.sessions = [{
          checkInTime: checkInTime,
          checkInLat: lat,
          checkInLng: lng,
          checkInPlace: place || 'Position Captured',
          checkInAccuracy: accuracy
        }];
        await attendance.save();
        console.log('[OfflineQueue Fix] Populated empty attendance check-in during check-out sync:', attendance);
      } else if (attendance.checkOutTime) {
        // Already checked out? Return success to clear the offline sync queue
        return res.json({ success: true, data: attendance });
      }
    }

    // Migrate legacy sessions if empty
    if (!attendance.sessions || attendance.sessions.length === 0) {
      attendance.sessions = [{
        checkInTime: attendance.checkInTime,
        checkInLat: attendance.checkInLat,
        checkInLng: attendance.checkInLng,
        checkInPlace: attendance.checkInPlace,
        checkInAccuracy: attendance.checkInAccuracy,
        checkOutTime: null,
        workingHours: 0
      }];
    }

    // Find and update the active session check-out
    const activeSession = attendance.sessions.find(s => !s.checkOutTime);
    if (activeSession) {
      activeSession.checkOutTime = now;
      activeSession.checkOutLat = lat;
      activeSession.checkOutLng = lng;
      activeSession.checkOutPlace = place || 'Position Captured';
      activeSession.checkOutAccuracy = accuracy;
      
      const sessionMs = now - activeSession.checkInTime;
      activeSession.workingHours = parseFloat((sessionMs / (1000 * 60 * 60)).toFixed(2));
    }

    attendance.checkOutTime = now;
    attendance.checkOutLat = lat;
    attendance.checkOutLng = lng;
    attendance.checkOutPlace = place || 'Position Captured';
    attendance.checkOutAccuracy = accuracy;

    // Calculate cumulative working hours to update status
    let totalWorkingHours = 0;
    attendance.sessions.forEach(s => {
      if (s.checkInTime && s.checkOutTime) {
        const diffMs = s.checkOutTime - s.checkInTime;
        s.workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
        totalWorkingHours += s.workingHours;
      }
    });

    const shiftEndStr = attendance.shiftEndTime || attendance.shift.endTime;
    const { hours: checkoutHours, minutes: checkoutMinutes } = getISTHoursAndMinutes(now);
    const currentMins = checkoutHours * 60 + checkoutMinutes;
    const shiftEndMins = toMins(shiftEndStr);

    if (currentMins < shiftEndMins && !attendance.shift.isNightShift) {
      attendance.isEarlyCheckout = true;
    }

    // Update status based on cumulative working hours
    if (totalWorkingHours < 4) {
      attendance.status = 'half-day';
      attendance.isHalfDay = true;
    } else {
      attendance.isHalfDay = false;
      attendance.status = attendance.isLate ? 'late' : 'present';
    }

    attendance.notes = `Session ${attendance.sessions.length} check-out: ${formatISTTime(now)}. ${attendance.notes || ''}`;

    await attendance.save();

    res.json({ success: true, data: attendance });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get today's status for the inspector
 */
export const getMyStatus = async (req, res) => {
  try {
    const inspectorId = req.user._id;
    const tenantId = req.user.tenantId;

    console.log('getMyStatus - inspectorId:', inspectorId, 'tenantId:', tenantId);

    const today = getISTToday();
    const now = getISTNow();

    const attendance = await Attendance.findOne({
      inspector: inspectorId,
      date: { $gte: today }
    });

    // Auto Shift Detection for "Potential" shift if not checked in
    let shift = null;
    if (attendance && attendance.shift) {
      shift = await Shift.findById(attendance.shift);
    } else {
      const allShifts = await Shift.find({ tenantId, isActive: true });
      const { hours: statusHours, minutes: statusMinutes } = getISTHoursAndMinutes(now);
      const currentMins = statusHours * 60 + statusMinutes;
      console.log(`getMyStatus - current IST: ${formatISTTime(now)}, currentMins: ${currentMins}, shifts found: ${allShifts.length}`);
      shift = findShiftByTime(currentMins, allShifts, 15);
    }

    let canCheckIn = false;
    if (shift) {
      if (!attendance || !attendance.checkInTime) {
        canCheckIn = true;
      } else {
        const sessions = attendance.sessions || [];
        canCheckIn = !!attendance.checkOutTime && sessions.length < 3;
      }
    }

    let canCheckOut = !!attendance && !!attendance.checkInTime && !attendance.checkOutTime;

    res.json({
      success: true,
      data: {
        shift,
        attendance,
        canCheckIn,
        canCheckOut
      }
    });
  } catch (error) {
    console.error('getMyStatus error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get personal attendance history (Renamed to fulfill getMyHistory requests)
 */
export const getMyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const userId = req.user._id;
    console.log('=== getMyHistory ===');
    console.log('User:', req.user.firstName, req.user.lastName);
    console.log('userId:', userId);

    const history = await Attendance.find({ inspector: userId })
      .populate('shift', 'name displayName startTime endTime')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments({ inspector: userId });

    console.log('Found history records:', total);

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Legacy Compatibility: getMyAttendance (requested by attendanceRoutes.js)
 */
export const getMyAttendance = getMyHistory;

/**
 * Legacy Compatibility: Export attendance report (requested by attendanceRoutes.js)
 */
export const exportAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const tenantId = req.user.tenantId;

    // Parse dates timezone-independently to UTC midnight
    const parseLocalDate = (dateStr) => {
      const parts = dateStr.split('-').map(Number);
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));
    };

    const query = { tenantId };
    if (startDate && endDate) {
      const start = parseLocalDate(startDate);
      const partsEnd = endDate.split('-').map(Number);
      const end = new Date(Date.UTC(partsEnd[0], partsEnd[1] - 1, partsEnd[2], 23, 59, 59, 999));
      query.date = { $gte: start, $lte: end };
    }

    const logs = await Attendance.find(query)
      .populate('inspector', 'firstName lastName email')
      .populate('shift', 'name displayName startTime endTime')
      .sort({ date: 1 });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(logs.map(att => ({
      Date: new Date(att.date.getTime() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0],
      Inspector: `${att.inspector?.firstName || ''} ${att.inspector?.lastName || ''}`,
      Email: att.inspector?.email || 'N/A',
      Shift: att.shift?.displayName || 'N/A',
      CheckIn: att.checkInTime ? formatISTTime(att.checkInTime) : 'N/A',
      CheckOut: att.checkOutTime ? formatISTTime(att.checkOutTime) : 'N/A',
      WorkingHours: att.workingHours,
      Status: att.status,
      Late: att.isLate ? 'Yes' : 'No'
    })));

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Legacy Compatibility: getAttendance (requested by attendanceRoutes.js)
 */
export const getAttendance = async (req, res) => {
  try {
    const { startDate, endDate, inspectorId, status } = req.query;
    const tenantId = req.user.tenantId;

    console.log('getAttendance - startDate:', startDate, 'endDate:', endDate, 'tenantId:', tenantId);

    // Parse dates timezone-independently to UTC midnight
    const parseLocalDate = (dateStr) => {
      const parts = dateStr.split('-').map(Number);
      return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0));
    };

    const now = new Date();
    let start, end;
    if (startDate) {
      start = parseLocalDate(startDate);
    } else {
      // Start of current IST month normalized to UTC
      const temp = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      start = new Date(Date.UTC(temp.getUTCFullYear(), temp.getUTCMonth(), 1, 0, 0, 0, 0));
    }

    if (endDate) {
      const parts = endDate.split('-').map(Number);
      end = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999));
    } else {
      const temp = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      end = new Date(Date.UTC(temp.getUTCFullYear(), temp.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    const query = { tenantId, date: { $gte: start, $lte: end } };
    if (inspectorId) query.inspector = inspectorId;
    if (status) query.status = status;

    console.log('getAttendance - date range:', start.toISOString(), 'to', end.toISOString());
    console.log('getAttendance - full query:', JSON.stringify(query));

    const logs = await Attendance.find(query)
      .populate('inspector', 'firstName lastName username email')
      .populate('shift', 'name displayName')
      .sort({ date: -1 });

    console.log('getAttendance - found logs:', logs.length);
    if (logs.length > 0) {
      console.log('getAttendance - first log date:', logs[0].date);
      console.log('getAttendance - first log inspector:', logs[0].inspector);
    }

    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Legacy Compatibility: getAttendanceSummary (requested by attendanceRoutes.js)
 */
export const getAttendanceSummary = async (req, res) => {
  try {
    const today = getISTToday();
    const tenantId = req.user.tenantId;
    const query = { tenantId, date: { $gte: today } };

    const [totalUsers, present, late, halfDay] = await Promise.all([
      Attendance.countDocuments({ tenantId, date: { $gte: today } }),
      Attendance.countDocuments({ ...query, status: 'present' }),
      Attendance.countDocuments({ ...query, status: 'late' }),
      Attendance.countDocuments({ ...query, status: 'half-day' })
    ]);

    res.json({
      success: true,
      data: { totalUsers, present, late, halfDay, absent: Math.max(0, totalUsers - present - late - halfDay) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Legacy Compatibility: getAttendanceUsers (requested by attendanceRoutes.js)
 */
export const getAttendanceUsers = async (req, res) => {
  try {
    const logs = await Attendance.find({ tenantId: req.user.tenantId })
      .populate('inspector', 'firstName lastName email')
      .sort({ date: -1 });
    res.json({ success: true, users: logs }); // Old logic returned logs here
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Heartbeat (requested by attendanceRoutes.js)
 */
export const updateLastActive = async (req, res) => {
  try {
    const today = getISTToday();
    const attendance = await Attendance.findOne({
      inspector: req.user._id,
      date: { $gte: today },
      checkOutTime: null
    });

    if (attendance) {
      await attendance.save(); // Just trigger timestamps update or implement lastActive field
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Login Location (requested by attendanceRoutes.js)
 */
export const updateLoginLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;
    const today = getISTToday();
    const attendance = await Attendance.findOne({
      inspector: req.user._id,
      date: { $gte: today },
      checkOutTime: null
    });

    if (attendance) {
      attendance.checkInLat = lat;
      attendance.checkInLng = lng;
      attendance.checkInAccuracy = accuracy;
      await attendance.save();
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send OTP for attendance verification
 */
export const sendAttendanceOTP = async (req, res) => {
  try {
    const user = req.user;
    const mobile = user.mobile;
    
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'No mobile number registered' });
    }
    
    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Save OTP to user
    user.attendanceOTP = otp;
    await user.save();
    
    // Send OTP via SMS
    const result = await smsService.sendOTP(mobile, otp);
    
    if (!result.success) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
    
    res.json({ success: true, message: 'OTP sent to your mobile number' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Verify OTP for attendance verification
 */
export const verifyAttendanceOTP = async (req, res) => {
  try {
    const { otp } = req.body;
    const inspectorId = req.user._id;

    const user = await User.findById(inspectorId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.attendanceOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear OTP and mark as verified
    user.attendanceOTP = null;
    user.attendanceOTPVerified = true;
    await user.save();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify attendance OTP error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};