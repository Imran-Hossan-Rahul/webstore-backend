import mongoose from 'mongoose';
const uri = 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/';
mongoose.connect(uri).then(async () => {
  const contracts = await mongoose.connection.db.collection('contracts')
    .find({ createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } })
    .toArray();
  console.log(JSON.stringify(contracts.map(c => ({
    id: c._id,
    title: c.title,
    status: c.status,
    escrow: c.escrowBalance,
    patron: c.patron,
    craftsman: c.craftsman,
    milestones: c.milestones?.map(m => ({ title: m.title, funded: m.isFunded, amount: m.amount }))
  })), null, 2));
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
