require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Twilio } = require('twilio');

const app = express();
app.use(express.json());

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const port = process.env.PORT || 3000;

const client = new Twilio(accountSid, authToken);

const DATA_PATH = path.join(__dirname, 'users.json');

function readUserData() {
  const data = fs.readFileSync(DATA_PATH);
  return JSON.parse(data);
}

function writeUserData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

app.post('/call', async (req, res) => {
  const { userId, toNumber } = req.body;

  if (!userId || !toNumber) {
    return res.status(400).json({ error: 'userId এবং toNumber প্রয়োজন' });
  }

  const data = readUserData();
  const user = data.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User পাওয়া যায়নি' });
  }

  if (user.activeCalls.includes(toNumber)) {
    return res.status(400).json({ error: 'এই নাম্বারে ইতোমধ্যে কল চলছে' });
  }

  const callCost = 5;
  if (user.balance < callCost) {
    return res.status(400).json({ error: 'ব্যালেন্স কম আছে, রিচার্জ করুন' });
  }

  try {
    const call = await client.calls.create({
      url: 'http://demo.twilio.com/docs/voice.xml',
      to: toNumber,
      from: twilioNumber
    });

    user.balance -= callCost;
    user.activeCalls.push(toNumber);
    writeUserData(data);

    res.json({ message: 'কল সফলভাবে শুরু হয়েছে', callSid: call.sid, balance: user.balance });

    setTimeout(() => {
      const updatedData = readUserData();
      const updatedUser = updatedData.users.find(u => u.id === userId);
      if (updatedUser) {
        updatedUser.activeCalls = updatedUser.activeCalls.filter(n => n !== toNumber);
        writeUserData(updatedData);
        console.log(`Call to ${toNumber} ended, activeCalls updated.`);
      }
    }, 60000);

  } catch (err) {
    console.error('Twilio কল এরর:', err.message);
    res.status(500).json({ error: 'কল করতে সমস্যা হয়েছে' });
  }
});

app.get('/balance/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  const data = readUserData();
  const user = data.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User পাওয়া যায়নি' });
  }

  res.json({ balance: user.balance });
});

app.post('/recharge', (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ error: 'userId এবং amount প্রয়োজন' });
  }

  const data = readUserData();
  const user = data.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User পাওয়া যায়নি' });
  }

  user.balance += amount;
  writeUserData(data);

  res.json({ message: 'রিচার্জ সফল', balance: user.balance });
});

app.listen(port, () => {
  console.log(`App running at http://localhost:${port}`);
});
