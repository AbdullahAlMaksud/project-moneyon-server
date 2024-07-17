const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI from environment variables
const uri = process.env.MONGO_URI || `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.saokkle.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        await client.connect();
        const db = client.db('moneyonDB');
        const usersCollection = db.collection('users');

        // Register a new user
        app.post('/api/auth/register', async (req, res) => {
            const { name, pin, mobileNumber, email, role, photoURL } = req.body;
            console.log({ name, pin, email, mobileNumber, role, photoURL });

            try {
                // Check if user already exists
                const existingUser = await usersCollection.findOne({ $or: [{ mobileNumber }, { email }] });
                if (existingUser) {
                    return res.status(400).json({ message: 'User already exists with this mobile number or email' });
                }

                // Hash the PIN
                const salt = await bcrypt.genSalt(10);
                const hashedPin = await bcrypt.hash(pin, salt);

                // Create new user
                const newUser = {
                    name,
                    pin: hashedPin,
                    mobileNumber,
                    email,
                    role,
                    photoURL,
                    balance: 0,
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                // Save user to database
                await usersCollection.insertOne(newUser);

                res.status(201).json({ message: 'User registered successfully. Awaiting admin approval.', newUser });
            } catch (error) {
                res.status(500).json({ message: 'Server error. Please try again later.' });
            }
        });


        // Login user
        app.post('/api/auth/login', async (req, res) => {
            const { emailOrMobile, pin } = req.body;

            try {
                // Find user by email or mobile number
                const user = await usersCollection.findOne({
                    $or: [{ mobileNumber: emailOrMobile }, { email: emailOrMobile }]
                });

                if (!user) {
                    return res.status(400).json({ message: 'Invalid credentials' });
                }

                // Check PIN
                const isMatch = await bcrypt.compare(pin, user.pin);
                if (!isMatch) {
                    return res.status(400).json({ message: 'Invalid credentials' });
                }

                // Return user information
                const { name, mobileNumber, balance, photoURL, role } = user;
                res.status(200).json({ name, mobileNumber, balance, photoURL, role });
            } catch (error) {
                res.status(500).json({ message: 'Server error. Please try again later.' });
            }
        });

        app.post('/api/auth/logout', (req, res) => {
            // Clear session/token data here if applicable
            // Example: Clearing user session/token
            req.session?.destroy(err => {
                if (err) {
                    return res.status(500).json({ message: 'Failed to logout' });
                }
                res.clearCookie('session-cookie'); // Example: Clearing session cookie if used
                res.status(200).json({ message: 'Logout successful' });
            });
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
    }
}
connectToMongoDB().catch(console.dir);

// Basic test route
app.get('/', (req, res) => {
    res.send('MoneyOn Server is running....');
});

app.listen(port, () => {
    console.log(`MoneyOn server is running on port ${port}`);
});
