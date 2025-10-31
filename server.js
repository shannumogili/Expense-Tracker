console.log("Starting server");
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
console.log("Express app created");
app.use(express.json());
app.use(cors());
app.use(express.static('.'));
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trackerDB')
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log(err));

// User schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  googleId: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  resetPasswordCode: String,
  resetPasswordCodeExpires: Date
});
const User = mongoose.model('User', userSchema);

// Transaction schema
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  description: String,
  date: { type: Date, default: Date.now }
});
const Transaction = mongoose.model('Transaction', transactionSchema);

// Budget schema
const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  spent: { type: Number, default: 0 },
  month: { type: String, required: true }
});
const Budget = mongoose.model('Budget', budgetSchema);

// Goal schema
const goalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  targetAmount: { type: Number, required: true },
  savedAmount: { type: Number, default: 0 },
  targetDate: { type: Date, required: true }
});
const Goal = mongoose.model('Goal', goalSchema);

// Loan schema
const loanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  principalAmount: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  tenureMonths: { type: Number, required: true },
  emiAmount: { type: Number, required: true },
  remainingBalance: { type: Number, required: true },
  startDate: { type: Date, required: true },
  nextDueDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' }
});
const Loan = mongoose.model('Loan', loanSchema);

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied' });

  try {
    const verified = jwt.verify(token, "secretKey");
    req.userId = verified.id;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
}

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Passport Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    callbackURL: 'http://localhost:5000/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ googleId: profile.id });
      if (!user) {
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          user.googleId = profile.id;
          await user.save();
        } else {
          user = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id
          });
          await user.save();
        }
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Auth routes
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, email, password: hashed });
  await user.save();
  res.json({ message: 'User registered' });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  if (!user.password) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id }, "secretKey");
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
});

// Transaction routes
app.get('/transactions', verifyToken, async (req, res) => {
  const transactions = await Transaction.find({ userId: req.userId }).sort({ date: -1 });
  res.json(transactions);
});

app.post('/transactions', verifyToken, async (req, res) => {
  const transaction = new Transaction({ ...req.body, userId: req.userId });
  await transaction.save();
  res.json(transaction);
});

app.delete('/transactions/:id', verifyToken, async (req, res) => {
  await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.json({ message: 'Transaction deleted' });
});

// Budget routes
app.get('/budgets', verifyToken, async (req, res) => {
  const budgets = await Budget.find({ userId: req.userId });
  res.json(budgets);
});

app.post('/budgets', verifyToken, async (req, res) => {
  const budget = new Budget({ ...req.body, userId: req.userId });
  await budget.save();
  res.json(budget);
});

app.put('/budgets/:id', verifyToken, async (req, res) => {
  const budget = await Budget.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    req.body,
    { new: true }
  );
  res.json(budget);
});

app.delete('/budgets/:id', verifyToken, async (req, res) => {
  await Budget.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.json({ message: 'Budget deleted' });
});

// Goal routes
app.get('/goals', verifyToken, async (req, res) => {
  const goals = await Goal.find({ userId: req.userId });
  res.json(goals);
});

app.post('/goals', verifyToken, async (req, res) => {
  const goal = new Goal({ ...req.body, userId: req.userId });
  await goal.save();
  res.json(goal);
});

app.put('/goals/:id', verifyToken, async (req, res) => {
  const goal = await Goal.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    req.body,
    { new: true }
  );
  res.json(goal);
});

app.delete('/goals/:id', verifyToken, async (req, res) => {
  await Goal.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.json({ message: 'Goal deleted' });
});

// Loan routes
app.get('/loans', verifyToken, async (req, res) => {
  const loans = await Loan.find({ userId: req.userId });
  res.json(loans);
});

app.post('/loans', verifyToken, async (req, res) => {
  const { name, principalAmount, interestRate, tenureMonths, startDate } = req.body;

  // Calculate EMI
  const monthlyRate = interestRate / 100 / 12;
  const emi = (principalAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
              (Math.pow(1 + monthlyRate, tenureMonths) - 1);

  const nextDueDate = new Date(startDate);
  nextDueDate.setMonth(nextDueDate.getMonth() + 1);

  const loan = new Loan({
    ...req.body,
    userId: req.userId,
    emiAmount: emi,
    remainingBalance: principalAmount,
    nextDueDate
  });

  await loan.save();
  res.json(loan);
});

app.put('/loans/:id/pay', verifyToken, async (req, res) => {
  const loan = await Loan.findOne({ _id: req.params.id, userId: req.userId });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });

  loan.remainingBalance -= loan.emiAmount;
  if (loan.remainingBalance <= 0) loan.status = 'completed';
  else loan.nextDueDate = new Date(loan.nextDueDate.getFullYear(), loan.nextDueDate.getMonth() + 1, loan.nextDueDate.getDate());

  await loan.save();
  res.json(loan);
});

app.delete('/loans/:id', verifyToken, async (req, res) => {
  await Loan.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.json({ message: 'Loan deleted' });
});

// Google Auth
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, "secretKey");
    res.redirect(`http://localhost:5000/index.html?token=${token}`);
  }
);

// Forgot password
app.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ message: "User not found" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  user.resetPasswordCode = code;
  user.resetPasswordCodeExpires = Date.now() + 3600000;
  await user.save();

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Reset Code',
    text: `Your password reset code is: ${code}. This code will expire in 1 hour.`
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) return res.json({ message: "Error sending email" });
    res.json({ message: "Reset code sent to your email" });
  });
});

// Reset password
app.post('/reset-password', async (req, res) => {
  const { code, password } = req.body;
  const user = await User.findOne({
    resetPasswordCode: code,
    resetPasswordCodeExpires: { $gt: Date.now() }
  });
  if (!user) return res.json({ message: "Invalid or expired code" });

  const hashed = await bcrypt.hash(password, 10);
  user.password = hashed;
  user.resetPasswordCode = undefined;
  user.resetPasswordCodeExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successful" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
