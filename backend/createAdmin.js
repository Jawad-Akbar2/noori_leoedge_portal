const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Employee = require('./models/Employee');

dotenv.config();

const createAdmin = async () => {
    try {
        console.log("Connecting to MongoDB...");

        await mongoose.connect(process.env.MONGODB_URI, {
            family: 4 // Forces IPv4, bypasses SRV DNS issues on Windows
        });

        console.log("✅ Connected to MongoDB");

        const adminEmail = 'admin@example.com';
        const exists = await Employee.findOne({ email: adminEmail });

        if (exists) {
            console.log("ℹ️ Admin already exists");
            process.exit();
        }

        const admin = new Employee({
            email: adminEmail,
            employeeNumber: "ADM-001",
            firstName: "System",
            lastName: "Admin",
            department: "Manager",
            joiningDate: new Date(),
            hourlyRate: 0,
            status: "Active",
            password: "Admin@123456"
        });

        await admin.save();
        console.log("🚀 Admin created successfully!");
        process.exit();
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
};

createAdmin();
    