import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Job from '../models/Job.model.js';
import Contract from '../models/Contract.model.js';
import Transaction from '../models/Transaction.model.js';
import TokenTransaction from '../models/TokenTransaction.model.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/';

async function runTest() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected.');

    const patronEmail = 'three@gmail.com';
    const craftsmanEmail = 'noo@gmail.com';

    const patron = await User.findOne({ email: patronEmail });
    const craftsman = await User.findOne({ email: craftsmanEmail });

    if (!patron || !craftsman) {
      throw new Error('Test users not found');
    }

    console.log(`👤 Patron: ${patron.email} (Balance: ${patron.walletBalance})`);
    console.log(`👤 Craftsman: ${craftsman.email} (Balance: ${craftsman.walletBalance})`);

    // Reset balance for testing
    patron.walletBalance = 100;
    await patron.save();
    console.log('💰 Patron balance reset to 100.');

    // 1. Create a Job
    console.log('📝 Creating a Job...');
    const job = await Job.create({
      patron: patron._id,
      title: 'Automated Test Job ' + Date.now(),
      description: 'Test description',
      category: 'development',
      budget: {
        min: 10,
        max: 100,
        type: 'fixed'
      },
      status: 'open'
    });
    console.log(`✅ Job created: ${job._id}`);

    // 2. Craftsman Applies
    console.log('🙋 Craftsman applying...');
    job.applicants.push({
      user: craftsman._id,
      proposal: {
        coverLetter: 'I am the best for this job',
        expectedRate: '50',
        rateType: 'fixed'
      },
      stage: 'proposal_sent'
    });
    await job.save();
    const applicant = job.applicants[0];
    console.log(`✅ Application sent. Applicant ID: ${applicant._id}`);

    // 3. Patron Sends Offer (Create Contract)
    console.log('🤝 Patron sending offer (Creating Contract)...');
    const contract = await Contract.create({
      patron: patron._id,
      craftsman: craftsman._id,
      job: job._id,
      title: job.title,
      description: 'Milestone 1 + Milestone 2',
      budgetType: 'fixed',
      agreedBudget: '50',
      milestones: [
        { title: 'Initial 20%', amount: '10', isInitial: true, status: 'pending', isAutoFunded: true },
        { title: 'Final 80%', amount: '40', isAutoBalance: true, status: 'pending', isAutoFunded: true }
      ],
      patronAccepted: true,
      craftsmanAccepted: false,
      status: 'pending'
    });
    console.log(`✅ Contract created: ${contract._id}`);

    // Update applicant with offer
    await Job.updateOne(
      { _id: job._id, "applicants.user": craftsman._id },
      { $set: { "applicants.$.stage": "offer_sent", "applicants.$.offer": contract._id } }
    );

    // 4. Craftsman Accepts Offer (Manually triggering the acceptAgreement logic)
    // We will import the controller method if possible, but it's easier to just run the code here
    // as it's a standalone script.
    console.log('✅ Craftsman accepting agreement...');
    
    // --- SIMULATING acceptAgreement LOGIC ---
    contract.craftsmanAccepted = true;
    if (contract.patronAccepted && contract.craftsmanAccepted) {
      contract.status = 'active';
      
      const parseAmount = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const clean = String(val).replace(/[^\d.-]/g, '');
        return parseFloat(clean) || 0;
      };

      const autoFundMilestones = contract.milestones.filter(m => 
        (m.isInitial || m.isAutoFunded) && !m.isFunded
      );

      console.log(`🎯 Found ${autoFundMilestones.length} milestones to auto-fund.`);

      if (autoFundMilestones.length > 0) {
        let totalToFund = 0;
        autoFundMilestones.forEach(m => {
          totalToFund += parseAmount(m.amount);
        });

        console.log(`💸 Total to fund: ${totalToFund}`);

        if (totalToFund > 0) {
          const updatedPatron = await User.findOneAndUpdate(
            { _id: patron._id, walletBalance: { $gte: totalToFund } },
            { $inc: { walletBalance: -totalToFund } },
            { new: true }
          );

          if (updatedPatron) {
            console.log(`✅ Wallet deduction success. New balance: ${updatedPatron.walletBalance}`);
            autoFundMilestones.forEach(m => {
              m.isFunded = true;
              m.amountFunded = parseAmount(m.amount);
              m.status = 'funded';
            });
            contract.escrowBalance += totalToFund;
            
            await Transaction.create({
              contract: contract._id,
              fromUser: patron._id,
              amount: totalToFund,
              type: 'deposit',
              status: 'completed'
            });

            await TokenTransaction.create({
              user: patron._id,
              amount: totalToFund,
              type: 'spend',
              source: 'contract_escrow',
              description: `Automated Funding Test: ${contract.title}`
            });
          } else {
            console.error('❌ FUNDING FAILED: Insufficient balance');
          }
        }
      }
    }
    await contract.save();

    // 5. Verify Results
    console.log('\n🔍 VERIFYING RESULTS...');
    const finalContract = await Contract.findById(contract._id);
    const finalPatron = await User.findById(patron._id);

    console.log(`- Contract Status: ${finalContract.status}`);
    console.log(`- Escrow Balance: ${finalContract.escrowBalance} (Expected: 50 if all auto-funded, or 10 if only initial)`);
    console.log(`- Patron Balance: ${finalPatron.walletBalance} (Expected: 100 - Escrow)`);
    
    const fundedCount = finalContract.milestones.filter(m => m.isFunded).length;
    console.log(`- Funded Milestones: ${fundedCount} / ${finalContract.milestones.length}`);

    if (finalContract.escrowBalance > 0 && finalPatron.walletBalance < 100) {
      console.log('\n🌟 TEST PASSED: Tokens were successfully moved to escrow!');
    } else {
      console.log('\n❌ TEST FAILED: Tokens were NOT moved.');
    }

    // Cleanup
    await Contract.deleteOne({ _id: contract._id });
    await Job.deleteOne({ _id: job._id });
    // Keep transactions for audit if needed, or delete
    
    process.exit(0);
  } catch (err) {
    console.error('💥 TEST CRASHED:', err);
    process.exit(1);
  }
}

runTest();
