/**
 * Script to seed sample package payment data for testing
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PackagePayment from '../schemas/PackagePayment.js';
import User from '../schemas/User.js';
import PackagePlan from '../schemas/PackagePlan.js';

dotenv.config();

const seedPackagePayments = async () => {
    try {
        // Connect to database
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            console.log('❌ MONGODB_URI not found in .env file');
            process.exit(1);
        }
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Get a user (preferably landlord)
        const users = await User.find({ role: 'landlord' }).limit(5);
        if (users.length === 0) {
            console.log('❌ No users found. Please create users first.');
            process.exit(1);
        }

        // Get package plans
        const packagePlans = await PackagePlan.find().limit(3);
        if (packagePlans.length === 0) {
            console.log('❌ No package plans found. Please create package plans first.');
            process.exit(1);
        }

        console.log(`Found ${users.length} users and ${packagePlans.length} package plans`);

        // Clear existing data
        const deleteCount = await PackagePayment.deleteMany({});
        console.log(`🗑️  Deleted ${deleteCount.deletedCount} existing package payments`);

        // Create sample payments
        const samplePayments = [];
        
        // Create paid payments (last 3 months)
        for (let i = 0; i < 10; i++) {
            const user = users[i % users.length];
            const packagePlan = packagePlans[i % packagePlans.length];
            const daysAgo = Math.floor(Math.random() * 90); // Random day in last 3 months
            const createdAt = new Date();
            createdAt.setDate(createdAt.getDate() - daysAgo);
            
            const paidAt = new Date(createdAt);
            paidAt.setHours(paidAt.getHours() + Math.floor(Math.random() * 48)); // Paid within 48 hours

            samplePayments.push({
                user: user._id,
                packagePlan: packagePlan._id,
                amount: packagePlan.price,
                paymentMethod: ['momo', 'vnpay', 'bank_transfer'][Math.floor(Math.random() * 3)],
                transactionId: `PKG${Date.now()}${i}`,
                status: 'paid',
                paidAt: paidAt,
                createdAt: createdAt
            });
        }

        // Create pending payments (recent)
        for (let i = 0; i < 5; i++) {
            const user = users[i % users.length];
            const packagePlan = packagePlans[i % packagePlans.length];
            const hoursAgo = Math.floor(Math.random() * 72); // Last 3 days
            const createdAt = new Date();
            createdAt.setHours(createdAt.getHours() - hoursAgo);

            samplePayments.push({
                user: user._id,
                packagePlan: packagePlan._id,
                amount: packagePlan.price,
                paymentMethod: ['momo', 'vnpay'][Math.floor(Math.random() * 2)],
                transactionId: `PKG${Date.now()}${10 + i}`,
                status: 'pending',
                createdAt: createdAt
            });
        }

        // Create cancelled payment
        const cancelledDate = new Date();
        cancelledDate.setDate(cancelledDate.getDate() - 15);
        samplePayments.push({
            user: users[0]._id,
            packagePlan: packagePlans[0]._id,
            amount: packagePlans[0].price,
            paymentMethod: 'momo',
            transactionId: `PKG${Date.now()}CANCEL`,
            status: 'cancelled',
            createdAt: cancelledDate
        });

        // Insert all payments
        const insertedPayments = await PackagePayment.insertMany(samplePayments);
        console.log(`✅ Created ${insertedPayments.length} sample package payments`);

        // Show summary
        const stats = {
            total: insertedPayments.length,
            paid: insertedPayments.filter(p => p.status === 'paid').length,
            pending: insertedPayments.filter(p => p.status === 'pending').length,
            cancelled: insertedPayments.filter(p => p.status === 'cancelled').length
        };
        
        console.log('\n📊 Summary:');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Paid: ${stats.paid}`);
        console.log(`   Pending: ${stats.pending}`);
        console.log(`   Cancelled: ${stats.cancelled}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding package payments:', error);
        process.exit(1);
    }
};

seedPackagePayments();
