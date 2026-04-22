import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Tenant from '../models/Tenant.js';
import connectDB from '../config/database.js';

dotenv.config();

const createInspector = async () => {
    try {
        await connectDB();
        
        const tenantSlug = 'laxmi-metals-tvs';
        const tenant = await Tenant.findOne({ slug: tenantSlug });
        
        if (!tenant) {
            console.error('Laxmi Metals tenant not found!');
            return;
        }

        const inspectorEmail = 'inspector@laxmi.com';
        let inspector = await User.findOne({ email: inspectorEmail });

        if (!inspector) {
            inspector = new User({
                username: 'lminstrictor',
                email: inspectorEmail,
                password: 'inspector123',
                firstName: 'Laxmi',
                lastName: 'Inspector',
                role: 'inspector',
                tenantId: tenant._id,
                isActive: true
            });
            await inspector.save();
            console.log('✅ Inspector user created: inspector@laxmi.com / inspector123');
        } else {
            inspector.tenantId = tenant._id;
            inspector.password = 'inspector123';
            inspector.role = 'inspector';
            await inspector.save();
            console.log('✅ Inspector user updated: inspector@laxmi.com / inspector123');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.disconnect();
    }
};

createInspector();
