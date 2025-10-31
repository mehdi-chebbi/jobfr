const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

// Microsoft Graph API dependencies
const { ConfidentialClientApplication } = require('@azure/msal-node');
const axios = require('axios');

const app = express();

// Helper function to get current time in MySQL format (Tunisia UTC+1)
function getLocalTime() {
  const now = new Date();
  // Since the server is already in Tunisia time (UTC+1), we don't need to add anything
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// Helper function to get current Date object in Tunisia time
function getLocalDate() {
  // Since the server is already in Tunisia time (UTC+1), we can just return new Date()
  return new Date();
}

const allowedOrigins = [
  'http://10.1.10.182',
  'http://192.168.2.136',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('Blocked CORS request from:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

app.use(express.json());

// Microsoft Graph API Configuration
// Microsoft Graph API Configuration
const OUTLOOK_CONFIG = {
    clientId: process.env.OUTLOOK_CLIENT_ID ,
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
    tenantId: process.env.OUTLOOK_TENANT_ID ,
    userEmail: process.env.OUTLOOK_USER_EMAIL
};


// MSAL Configuration
const clientConfig = {
    auth: {
        clientId: OUTLOOK_CONFIG.clientId,
        clientSecret: OUTLOOK_CONFIG.clientSecret,
        authority: `https://login.microsoftonline.com/${OUTLOOK_CONFIG.tenantId}`
    }
};

const cca = new ConfidentialClientApplication(clientConfig);

// Function to get access token for Microsoft Graph
async function getAccessToken() {
    const clientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
        const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
        return response.accessToken;
    } catch (error) {
        console.error('Error getting Microsoft Graph access token:', error.message);
        throw error;
    }
}

// Enhanced email sending function using Microsoft Graph API
async function sendEmailWithGraphAPI(to, subject, htmlContent, textContent = null) {
    try {
        const accessToken = await getAccessToken();

        const emailData = {
            message: {
                subject: subject,
                body: {
                    contentType: 'HTML',
                    content: htmlContent
                },
                from: {
                    emailAddress: {
                        address: OUTLOOK_CONFIG.userEmail,
                        name: "HR Job Portal"
                    }
                },
                toRecipients: [
                    {
                        emailAddress: {
                            address: to
                        }
                    }
                ]
            }
        };

        const response = await axios.post(
            `https://graph.microsoft.com/v1.0/users/${OUTLOOK_CONFIG.userEmail}/sendMail`,
            emailData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`Email sent successfully to ${to}`);
        return response.data;

    } catch (error) {
        console.error('Error sending email via Graph API:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Create email templates (unchanged)
function createHRNotificationEmail(hrName, offerTitle, applicantName, applicantEmail) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #343a40; margin: 0;">New Application Received</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Hello <strong>${hrName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    You have received a new application for your job offer:
                </p>

                <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Offer:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Applicant:</strong> ${applicantName}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> ${applicantEmail}</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    Please log into the HR portal to review the application and download the submitted documents.
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        This is an automated notification from the HR Job Portal
                    </p>
                </div>
            </div>
        </div>
    `;
}

function createApplicantConfirmationEmail(applicantName, offerTitle) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #155724; margin: 0;">Application Submitted Successfully</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Dear <strong>${applicantName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    Thank you for your application! We have successfully received your submission for:
                </p>

                <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Position:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleDateString()}</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    Our HR team will review your application and contact you if your profile matches our requirements.
                    This process may take some time, so please be patient.
                </p>

                <p style="color: #495057; font-size: 14px;">
                    <strong>Next Steps:</strong>
                </p>
                <ul style="color: #495057; font-size: 14px;">
                    <li>Your application is now under review</li>
                    <li>We will contact you if you are selected for the next stage</li>
                    <li>Please keep your contact information up to date</li>
                </ul>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        Best regards,<br>
                        HR Team<br>
                        Job Portal System
                    </p>
                </div>
            </div>
        </div>
    `;
}

function createExpirationNotificationEmail(recipientName, offerTitle, deadline) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #721c24; margin: 0;">Offer Expired</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Hello <strong>${recipientName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    Your job offer has reached its deadline and has now expired:
                </p>

                <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                    <p style="margin: 5px 0;"><strong>Offer:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Deadline:</strong> ${deadline}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Expired</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    <strong>Recommended Actions:</strong>
                </p>
                <ul style="color: #495057; font-size: 14px;">
                    <li>Review and process any pending applications</li>
                    <li>Close the position if filled</li>
                    <li>Extend the deadline if you need more time</li>
                    <li>Create a new offer if needed</li>
                </ul>

                <p style="color: #495057; font-size: 14px;">
                    Please log into the HR portal to take the necessary actions.
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        This is an automated notification from the HR Job Portal
                    </p>
                </div>
            </div>
        </div>
    `;
}

function createUpcomingExpirationNotificationEmail(recipientName, offerTitle, deadline, daysUntilExpiration) {
    const urgencyColor = daysUntilExpiration === 1 ? '#f8d7da' : '#fff3cd';
    const urgencyTextColor = daysUntilExpiration === 1 ? '#721c24' : '#856404';
    const urgencyBorder = daysUntilExpiration === 1 ? '#dc3545' : '#ffc107';
    const urgencyTitle = daysUntilExpiration === 1 ? 'Offer Expiring Tomorrow' : 'Offer Expiring in 2 Days';

    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: ${urgencyColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: ${urgencyTextColor}; margin: 0;">${urgencyTitle}</h2>
            </div>

            <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                <p style="color: #495057; font-size: 16px;">Hello <strong>${recipientName}</strong>,</p>

                <p style="color: #495057; font-size: 14px;">
                    Your job offer is approaching its deadline:
                </p>

                <div style="background-color: ${urgencyColor}; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${urgencyBorder};">
                    <p style="margin: 5px 0;"><strong>Offer:</strong> ${offerTitle}</p>
                    <p style="margin: 5px 0;"><strong>Deadline:</strong> ${deadline}</p>
                    <p style="margin: 5px 0;"><strong>Time Remaining:</strong> ${daysUntilExpiration} day${daysUntilExpiration > 1 ? 's' : ''}</p>
                </div>

                <p style="color: #495057; font-size: 14px;">
                    <strong>Recommended Actions:</strong>
                </p>
                <ul style="color: #495057; font-size: 14px;">
                    <li>Review current applications</li>
                    <li>Extend the deadline if you need more candidates</li>
                    <li>Prepare for application processing when the offer expires</li>
                    <li>Note that you'll have ${daysUntilExpiration === 1 ? '1 day' : '2 days'} after expiration to archive applications</li>
                </ul>

                <p style="color: #495057; font-size: 14px;">
                    Please log into the HR portal to manage your offer and applications.
                </p>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="color: #6c757d; font-size: 12px; margin: 0;">
                        This is an automated notification from the HR Job Portal
                    </p>
                </div>
            </div>
        </div>
    `;
}

// Create base directories if they don't exist
const baseFilesDir = path.join(__dirname, 'files');
const tdrDir = path.join(baseFilesDir, 'tdr');
const applicantsDir = path.join(baseFilesDir, 'applicants');
[baseFilesDir, tdrDir, applicantsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Function to sanitize filenames
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Multer setup for TDR files
const tdrStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tdrDir);
  },
  filename: (req, file, cb) => {
    const title = req.body.title || 'unknown';
    const sanitizedTitle = sanitizeFilename(title);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${sanitizedTitle}-tdr-${uniqueSuffix}.pdf`);
  }
});

// Multer setup for applicant files
const applicantStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fullName = req.body.full_name || 'unknown';
    const sanitizedName = sanitizeFilename(fullName);
    const applicantDir = path.join(applicantsDir, sanitizedName);

    // Create applicant directory if it doesn't exist
    if (!fs.existsSync(applicantDir)) {
      fs.mkdirSync(applicantDir, { recursive: true });
    }

    cb(null, applicantDir);
  },
  filename: (req, file, cb) => {
    const documentType = file.fieldname;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${documentType}-${uniqueSuffix}.pdf`);
  }
});

const uploadTdr = multer({ storage: tdrStorage });
const uploadApplicant = multer({ storage: applicantStorage });

// Dynamic multer configuration that accepts any field
const uploadApplicantDynamic = multer({ storage: applicantStorage });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rh_app', // optional fallback
  port: Number(process.env.DB_PORT) || 3306,
};

const JWT_SECRET = 'your_jwt_secret'; // Use env var in production
let pool;

// ───── Initialize DB ─────
(async () => {
  try {
    console.log('Attempting to connect to MySQL...');
    const connection = await mysql.createConnection(DB_CONFIG);
    console.log('Connected to MySQL successfully');

    console.log('Creating database if not exists...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS rh_app`);
    console.log('Database creation query executed');

    await connection.end();
    console.log('Disconnected from initial connection');

    console.log('Creating connection pool with rh_app database...');
    pool = mysql.createPool({ ...DB_CONFIG, database: 'rh_app' });
    console.log('Connection pool created');

    console.log('Creating tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'comite_ajout', 'comite_ouverture') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY (name, created_by)
      )
    `);
    console.log('Departments table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        department_id INT NOT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY (name, department_id, created_by)
      )
    `);
    console.log('Projects table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('candidature', 'manifestation', 'appel_d_offre_service', 'appel_d_offre_equipement', 'consultation') NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        country VARCHAR(100) NOT NULL,
        project_id INT NOT NULL,
        reference VARCHAR(255) NOT NULL,
        created_by INT NOT NULL,
        deadline DATETIME NOT NULL,
        status ENUM('actif', 'sous_evaluation', 'resultat') NOT NULL DEFAULT 'actif',
        winner_name VARCHAR(255) NULL,
        two_day_notified BOOLEAN DEFAULT FALSE,
        one_day_notified BOOLEAN DEFAULT FALSE,
        deadline_notified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        tdr_filename VARCHAR(255) NULL,
        tdr_filepath VARCHAR(255) NULL,
        notification_emails TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    console.log('Offers table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id INT NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        tel_number VARCHAR(50) NOT NULL,
        applicant_country VARCHAR(100) NOT NULL,
        cv_filename VARCHAR(255) NOT NULL,
        cv_filepath VARCHAR(255) NOT NULL,
        diplome_filename VARCHAR(255) NOT NULL,
        diplome_filepath VARCHAR(255) NOT NULL,
        id_card_filename VARCHAR(255) NOT NULL,
        id_card_filepath VARCHAR(255) NOT NULL,
        cover_letter_filename VARCHAR(255) NOT NULL,
        cover_letter_filepath VARCHAR(255) NOT NULL,
        declaration_sur_honneur_filename VARCHAR(255) NULL,
        declaration_sur_honneur_filepath VARCHAR(255) NULL,
        fiche_de_referencement_filename VARCHAR(255) NULL,
        fiche_de_referencement_filepath VARCHAR(255) NULL,
        extrait_registre_filename VARCHAR(255) NULL,
        extrait_registre_filepath VARCHAR(255) NULL,
        note_methodologique_filename VARCHAR(255) NULL,
        note_methodologique_filepath VARCHAR(255) NULL,
        liste_references_filename VARCHAR(255) NULL,
        liste_references_filepath VARCHAR(255) NULL,
        offre_financiere_filename VARCHAR(255) NULL,
        offre_financiere_filepath VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archived_at TIMESTAMP NULL,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
        UNIQUE KEY (offer_id, email)
      )
    `);
    console.log('Applications table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_required_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id INT NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        document_key VARCHAR(255) NOT NULL,
        required BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_offer_document (offer_id, document_key)
      )
    `);
    console.log('Custom required documents table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_custom_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        custom_document_id INT NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
        FOREIGN KEY (custom_document_id) REFERENCES custom_required_documents(id) ON DELETE CASCADE
      )
    `);
    console.log('Applicant custom documents table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_other_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        application_id INT NOT NULL,
        document_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
      )
    `);
    console.log('Applicant other documents table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Logs table created');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        offer_id INT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        answered_at TIMESTAMP NULL,
        FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
      )
    `);
    console.log('Questions table created');

    console.log('Database and tables initialized successfully.');

    // Schedule daily check for expired offers at midnight
    cron.schedule('0 0 * * *', checkExpiredOffers);
    console.log('Scheduled cron job for checking expired offers');
  } catch (err) {
    console.error('DB Init Error:', err);
  }
})();

function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (Array.isArray(role)) {
      if (!role.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    } else {
      if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function logAction(message) {
  pool.query('INSERT INTO logs (message) VALUES (?)', [message]);
}

function logOfferAction(user, action, offerTitle) {
  const message = `${user.name} (${user.email}) ${action} offer "${offerTitle}"`;
  logAction(message);
}

app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});

// ───── Auth ─────
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── Users (Admin only) ─────
app.post('/users', auth, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !['admin', 'comite_ajout', 'comite_ouverture'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user data' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hashed, role]);
    logAction(`${req.user.name} (${req.user.email}) created user ${name} (${role})`);
    res.json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: 'User creation failed' });
  }
});

app.get('/users', auth, requireRole('admin'), async (req, res) => {
  const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users');
  res.json(users);
});

app.put('/users/:id', auth, requireRole('admin'), async (req, res) => {
  const { name, email, role } = req.body;
  const { id } = req.params;
  if (!name || !email || !['admin', 'comite_ajout', 'comite_ouverture'].includes(role)) {
    return res.status(400).json({ error: 'Invalid user data' });
  }
  try {
    await pool.query('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name, email, role, id]);
    logAction(`${req.user.name} (${req.user.email}) updated user ${id}`);
    res.json({ message: 'User updated' });
  } catch {
    res.status(500).json({ error: 'User update failed' });
  }
});

app.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    logAction(`${req.user.name} (${req.user.email}) deleted user ${req.params.id}`);
    res.json({ message: 'User deleted' });
  } catch {
    res.status(500).json({ error: 'User delete failed' });
  }
});

app.get('/logs', auth, requireRole('admin'), async (req, res) => {
  const [logs] = await pool.query('SELECT * FROM logs ORDER BY created_at DESC');
  res.json(logs);
});

// ───── Departments (RH only) ─────
app.get('/departments', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    const [departments] = await pool.query(`
      SELECT d.*, u.name as created_by_name
      FROM departments d
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.created_by = ?
      ORDER BY d.name ASC
    `, [req.user.id]);
    res.json(departments);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

app.post('/departments', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO departments (name, description, created_by) VALUES (?, ?, ?)',
      [name, '', req.user.id]
    );
    logAction(`${req.user.name} (${req.user.email}) created department "${name}"`);
    res.json({ id: result.insertId, name });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Department with this name already exists' });
    }
    console.error('Error creating department:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

app.put('/departments/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  if (!name) return res.status(400).json({ error: 'Department name is required' });

  try {
    // Verify department belongs to user
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    await pool.query('UPDATE departments SET name = ? WHERE id = ?', [name, id]);
    logAction(`${req.user.name} (${req.user.email}) updated department "${name}"`);
    res.json({ message: 'Department updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Department with this name already exists' });
    }
    console.error('Error updating department:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

app.delete('/departments/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    // Verify department belongs to user and has no projects
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [req.params.id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const [projectCheck] = await pool.query('SELECT COUNT(*) as count FROM projects WHERE department_id = ?', [req.params.id]);
    if (projectCheck[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete department with existing projects' });
    }

    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    logAction(`${req.user.name} (${req.user.email}) deleted department id ${req.params.id}`);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// ───── Projects (RH only) ─────
app.get('/projects', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    const [projects] = await pool.query(`
      SELECT p.*, d.name as department_name, u.name as created_by_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE p.created_by = ?
      ORDER BY d.name ASC, p.name ASC
    `, [req.user.id]);
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.get('/projects/department/:departmentId', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    const { departmentId } = req.params;

    // Verify department belongs to user
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [departmentId]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const [projects] = await pool.query(`
      SELECT p.*, d.name as department_name
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.department_id = ? AND p.created_by = ?
      ORDER BY p.name ASC
    `, [departmentId, req.user.id]);
    res.json(projects);
  } catch (err) {
    console.error('Error fetching projects for department:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.post('/projects', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name, department_id } = req.body;
  if (!name || !department_id) return res.status(400).json({ error: 'Project name and department are required' });

  try {
    // Verify department belongs to user
    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [department_id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (name, description, department_id, created_by) VALUES (?, ?, ?, ?)',
      [name, '', department_id, req.user.id]
    );
    logAction(`${req.user.name} (${req.user.email}) created project "${name}"`);
    res.json({ id: result.insertId, name, department_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Project with this name already exists in this department' });
    }
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.put('/projects/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  const { name, department_id } = req.body;
  const { id } = req.params;

  if (!name || !department_id) return res.status(400).json({ error: 'Project name and department are required' });

  try {
    // Verify project belongs to user and department belongs to user
    const [projectCheck] = await pool.query(`
      SELECT p.created_by, d.created_by as dept_created_by
      FROM projects p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `, [id]);

    if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const [deptCheck] = await pool.query('SELECT created_by FROM departments WHERE id = ?', [department_id]);
    if (deptCheck.length === 0 || deptCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Department not found or access denied' });
    }

    await pool.query('UPDATE projects SET name = ?, department_id = ? WHERE id = ?',
      [name, department_id, id]);
    logAction(`${req.user.name} (${req.user.email}) updated project "${name}"`);
    res.json({ message: 'Project updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Project with this name already exists in this department' });
    }
    console.error('Error updating project:', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/projects/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    // Verify project belongs to user and has no offers
    const [projectCheck] = await pool.query('SELECT created_by FROM projects WHERE id = ?', [req.params.id]);
    if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const [offerCheck] = await pool.query('SELECT COUNT(*) as count FROM offers WHERE project_id = ?', [req.params.id]);
    if (offerCheck[0].count > 0) {
      return res.status(400).json({ error: 'Impossible de supprimer un projet contenant des offres existantes.' });
    }

    await pool.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
    logAction(`${req.user.name} (${req.user.email}) deleted project id ${req.params.id}`);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ───── Offers ─────
// Get all offers with tdr url if exists (including expired for frontend filtering)
app.get('/offers', async (req, res) => {
  try {
    // Get current server local time for real-time status checking
    const now = getLocalDate();
    
    // First, update any expired offers from actif to sous_evaluation
    // Use Tunisia time comparison directly
    await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);
    
    const [offers] = await pool.query(`
      SELECT o.id, o.type, o.title, o.description, o.country,
             p.name as project_name, d.name as department_name,
             o.reference, o.deadline, o.created_at, o.tdr_filename, o.tdr_filepath,
             o.status, o.winner_name
      FROM offers o
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      ORDER BY o.created_at DESC
    `);
    const offersWithUrl = offers.map(offer => ({
      ...offer,
      tdr_url: offer.tdr_filename ? `/offers/${offer.id}/tdr` : null
    }));
    res.json(offersWithUrl);
  } catch (err) {
    console.error('Error fetching offers:', err);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Get all offers for dashboard (including expired)
app.get('/offers/dashboard', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    // Use server local time for consistent comparison
    const now = getLocalDate();
    
    // First, update any expired offers from actif to sous_evaluation
    // Use Tunisia time comparison directly
    await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);
    
    // For comite_ouverture, show all offers. For comite_ajout, show only user's offers.
    const whereClause = req.user.role === 'comite_ouverture' ? '' : 'WHERE o.created_by = ?';
    const params = req.user.role === 'comite_ouverture' ? [] : [req.user.id];

    const [offers] = await pool.query(`
      SELECT o.id, o.type, o.title, o.description, o.country,
             p.name as project_name, d.name as department_name,
             o.reference, o.deadline, o.created_at, o.tdr_filename, o.tdr_filepath,
             o.status, o.winner_name,
             CASE
               WHEN o.deadline > ? THEN NULL
               WHEN TIMESTAMPDIFF(HOUR, o.deadline, ?) <= 336 THEN 'archive_window_open' -- 14 days = 336 hours
               ELSE 'archive_window_closed'
             END as archive_window_status,
             TIMESTAMPDIFF(HOUR, o.deadline, ?) as hours_since_expiry,
             CASE
               WHEN o.deadline > ? THEN FALSE
               WHEN TIMESTAMPDIFF(HOUR, o.deadline, ?) <= 336 THEN TRUE
               ELSE FALSE
             END as can_archive
      FROM offers o
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      ${whereClause}
      ORDER BY o.deadline DESC
    `, [now, now, now, now, now, ...params]);

    const offersWithUrl = offers.map(offer => ({
      ...offer,
      tdr_url: offer.tdr_filename ? `/offers/${offer.id}/tdr` : null
    }));
    res.json(offersWithUrl);
  } catch (err) {
    console.error('Error fetching dashboard offers:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard offers' });
  }
});

// Get a single offer by ID
app.get('/offers/:id', async (req, res) => {
  try {
    // Get current server local time for real-time status checking
    const now = getLocalDate();
    
    // First, update any expired offers from actif to sous_evaluation
    // Use Tunisia time comparison directly
    await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);
    
    const [rows] = await pool.query(`
      SELECT o.id, o.type, o.title, o.description, o.country,
             p.name as project_name, d.name as department_name,
             o.reference, o.deadline, o.created_at, o.tdr_filename, o.tdr_filepath,
             o.notification_emails, o.project_id, o.status, o.winner_name
      FROM offers o
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = rows[0];
    
    // Get custom required documents for the offer
    const [customDocs] = await pool.query(
      `SELECT id, offer_id, document_name, document_key, required, created_at
       FROM custom_required_documents
       WHERE offer_id = ?`,
      [req.params.id]
    );
    
    const offerWithUrl = {
      ...offer,
      custom_required_documents: customDocs,
      tdr_url: offer.tdr_filename ? `/offers/${offer.id}/tdr` : null
    };

    res.json(offerWithUrl);
  } catch (err) {
    console.error('Error fetching offer:', err);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

app.post('/offers', auth, requireRole('comite_ajout'), uploadTdr.single('tdr'), async (req, res) => {
  try {
    const { type, title, description, country, project_id, reference, deadline, notification_emails, custom_documents } = req.body;
    const tdrFile = req.file;

    if (!type || !title || !country || !project_id || !reference || !deadline) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    if (tdrFile && tdrFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'TDR must be a PDF file' });
    }

    // Verify project belongs to user
    const [projectCheck] = await pool.query('SELECT created_by FROM projects WHERE id = ?', [project_id]);
    if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Project not found or access denied' });
    }

    const tdrFilename = tdrFile ? tdrFile.filename : null;
    const tdrFilepath = tdrFile ? tdrFile.path : null;

    // Parse notification emails
    let emails = [];
    if (notification_emails) {
      try {
        emails = JSON.parse(notification_emails);
        // Validate emails (simple validation)
        emails = emails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        // Limit to 10 emails
        emails = emails.slice(0, 10);
      } catch (e) {
        console.error('Error parsing notification emails:', e);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO offers (type, title, description, country, project_id, reference, deadline, status, created_by, tdr_filename, tdr_filepath, notification_emails)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'actif', ?, ?, ?, ?)`,
      [type, title, description, country, project_id, reference, deadline, req.user.id, tdrFilename, tdrFilepath, JSON.stringify(emails)]
    );

    const offerId = result.insertId;

    // Handle custom required documents
    if (custom_documents) {
      try {
        const documents = JSON.parse(custom_documents);
        if (Array.isArray(documents) && documents.length > 0) {
          for (const doc of documents) {
            await pool.query(
              `INSERT INTO custom_required_documents (offer_id, document_name, document_key, required)
               VALUES (?, ?, ?, ?)`,
              [offerId, doc.name, doc.key, doc.required ? 1 : 0]
            );
          }
        }
      } catch (e) {
        console.error('Error parsing custom documents:', e);
      }
    }

    // Get the complete offer data to return to frontend
    const [newOffer] = await pool.query(
      `SELECT o.*, p.name as project_name, d.name as department_name, u.name as created_by_name, u.email as created_by_email
       FROM offers o
       LEFT JOIN projects p ON o.project_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = ?`,
      [offerId]
    );

    // Get custom required documents for the offer
    const [customDocs] = await pool.query(
      `SELECT id, offer_id, document_name, document_key, required, created_at
       FROM custom_required_documents
       WHERE offer_id = ?`,
      [offerId]
    );

    const offerData = { ...newOffer[0], custom_required_documents: customDocs };

    logOfferAction(req.user, 'created', title);
    res.json(offerData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/offers/:id', auth, requireRole('comite_ajout'), uploadTdr.single('tdr'), async (req, res) => {
  try {
    const { type, title, description, country, project_id, reference, deadline, notification_emails, custom_documents } = req.body;
    const tdrFile = req.file;
    const { id } = req.params;

    if (tdrFile && tdrFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'TDR must be a PDF file' });
    }

    // Verify project belongs to user
    if (project_id) {
      const [projectCheck] = await pool.query('SELECT created_by FROM projects WHERE id = ?', [project_id]);
      if (projectCheck.length === 0 || projectCheck[0].created_by !== req.user.id) {
        return res.status(403).json({ error: 'Project not found or access denied' });
      }
    }

    // Get existing TDR info to delete old file if replacing
    const [existingOffer] = await pool.query('SELECT tdr_filename, tdr_filepath FROM offers WHERE id = ?', [id]);
    const oldTdrInfo = existingOffer[0];

    let tdrFilename = oldTdrInfo?.tdr_filename || null;
    let tdrFilepath = oldTdrInfo?.tdr_filepath || null;

    if (tdrFile) {
      tdrFilename = tdrFile.filename;
      tdrFilepath = tdrFile.path;

      // Delete old TDR file if exists
      if (oldTdrInfo?.tdr_filepath && fs.existsSync(oldTdrInfo.tdr_filepath)) {
        fs.unlinkSync(oldTdrInfo.tdr_filepath);
      }
    }

    // Parse notification emails
    let emails = [];
    if (notification_emails) {
      try {
        emails = JSON.parse(notification_emails);
        // Validate emails (simple validation)
        emails = emails.filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        // Limit to 10 emails
        emails = emails.slice(0, 10);
      } catch (e) {
        console.error('Error parsing notification emails:', e);
      }
    }

    await pool.query(
      `UPDATE offers SET type = ?, title = ?, description = ?, country = ?, project_id = ?, reference = ?, deadline = ?, status = ?, winner_name = ?, tdr_filename = ?, tdr_filepath = ?, notification_emails = ? WHERE id = ?`,
      [type, title, description, country, project_id, reference, deadline, 'actif', null, tdrFilename, tdrFilepath, JSON.stringify(emails), id]
    );

    // Handle custom required documents - delete existing and recreate
    await pool.query('DELETE FROM custom_required_documents WHERE offer_id = ?', [id]);
    
    if (custom_documents) {
      try {
        const documents = JSON.parse(custom_documents);
        if (Array.isArray(documents) && documents.length > 0) {
          for (const doc of documents) {
            await pool.query(
              `INSERT INTO custom_required_documents (offer_id, document_name, document_key, required)
               VALUES (?, ?, ?, ?)`,
              [id, doc.name, doc.key, doc.required ? 1 : 0]
            );
          }
        }
      } catch (e) {
        console.error('Error parsing custom documents:', e);
      }
    }

    // Get the updated offer data to return to frontend
    const [updatedOffer] = await pool.query(
      `SELECT o.*, p.name as project_name, d.name as department_name, u.name as created_by_name, u.email as created_by_email
       FROM offers o
       LEFT JOIN projects p ON o.project_id = p.id
       LEFT JOIN departments d ON p.department_id = d.id
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.id = ?`,
      [id]
    );

    // Get custom required documents for the offer
    const [customDocs] = await pool.query(
      `SELECT id, offer_id, document_name, document_key, required, created_at
       FROM custom_required_documents
       WHERE offer_id = ?`,
      [id]
    );

    const offerData = { ...updatedOffer[0], custom_required_documents: customDocs };

    logOfferAction(req.user, 'updated', title);
    res.json(offerData);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/offers/:id', auth, requireRole('comite_ajout'), async (req, res) => {
  try {
    // Get TDR info to delete file
    const [offer] = await pool.query('SELECT tdr_filename, tdr_filepath FROM offers WHERE id = ?', [req.params.id]);
    const tdrInfo = offer[0];

    await pool.query('DELETE FROM offers WHERE id = ?', [req.params.id]);

    // Delete TDR file if exists
    if (tdrInfo?.tdr_filepath && fs.existsSync(tdrInfo.tdr_filepath)) {
      fs.unlinkSync(tdrInfo.tdr_filepath);
    }

    logOfferAction(req.user, 'deleted', `offer id ${req.params.id}`);
    res.json({ message: 'Offer deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// Set winner for an offer (change status to 'resultat')
app.post('/offers/:id/set-winner', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { winner_name } = req.body;
    const { id } = req.params;

    if (!winner_name) {
      return res.status(400).json({ error: 'Winner name is required' });
    }

    // Verify offer exists and belongs to user (if comite_ajout)
    const whereClause = req.user.role === 'comite_ouverture' 
      ? 'WHERE id = ?' 
      : 'WHERE id = ? AND created_by = ?';
    const params = req.user.role === 'comite_ouverture' 
      ? [id] 
      : [id, req.user.id];

    const [offerCheck] = await pool.query(`SELECT id, title, status FROM offers ${whereClause}`, params);

    if (offerCheck.length === 0) {
      return res.status(404).json({ error: 'Offer not found or access denied' });
    }

    const offer = offerCheck[0];

    // Check if offer is in 'sous_evaluation' status
    if (offer.status !== 'sous_evaluation') {
      return res.status(400).json({ error: 'Offer must be in "sous_evaluation" status to set a winner' });
    }

    // Update offer status and set winner name
    await pool.query(
      'UPDATE offers SET status = ?, winner_name = ? WHERE id = ?',
      ['resultat', winner_name, id]
    );

    logOfferAction(req.user, `set winner for`, `"${offer.title}" - Winner: ${winner_name}`);
    res.json({ 
      message: `Winner "${winner_name}" has been set for offer "${offer.title}"`,
      winner_name: winner_name,
      status: 'resultat'
    });

  } catch (err) {
    console.error('Error setting winner:', err);
    res.status(500).json({ error: 'Failed to set winner' });
  }
});

app.get('/offers/:id/tdr', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT tdr_filename, tdr_filepath FROM offers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'TDR not found' });
    const { tdr_filename, tdr_filepath } = rows[0];
    if (!tdr_filename || !tdr_filepath) return res.status(404).json({ error: 'TDR not found' });

    if (!fs.existsSync(tdr_filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${tdr_filename}"`);
    res.sendFile(tdr_filepath);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── Applications ─────
// ───── Applications ─────
app.post('/apply', uploadApplicantDynamic.any(), async (req, res) => {
  try {
    console.log('Received application submission:', {
      body: req.body,
      filesCount: req.files ? req.files.length : 0,
      files: req.files ? req.files.map(f => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        mimetype: f.mimetype
      })) : []
    });

    const { offer_id, full_name, email, tel_number, applicant_country } = req.body;
    const files = req.files;

    // Check required fields
    if (!offer_id || !full_name || !email || !tel_number || !applicant_country) {
      console.log('Missing required fields:', { offer_id, full_name, email, tel_number, applicant_country });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Helper function to get file by fieldname from multer's any() output
    const getFileByFieldname = (fieldName) => {
      if (!files || !Array.isArray(files)) return null;
      return files.find(f => f.fieldname === fieldName);
    };

    // Check required files
    const requiredFiles = ['cv', 'diplome', 'id_card', 'cover_letter'];
    for (const fieldName of requiredFiles) {
      const file = getFileByFieldname(fieldName);
      
      if (!file) {
        console.log(`Missing required file: ${fieldName}`);
        console.log('Available fieldnames:', files ? files.map(f => f.fieldname) : []);
        return res.status(400).json({ error: `${fieldName} file is required` });
      }
      
      if (file.mimetype !== 'application/pdf') {
        console.log(`Invalid file type for ${fieldName}: ${file.mimetype}`);
        return res.status(400).json({ error: `${fieldName} must be a PDF file` });
      }
    }

    // Verify offer exists and get status
    const [offerRows] = await pool.query('SELECT id, title, type, created_by, deadline, status FROM offers WHERE id = ?', [offer_id]);
    if (offerRows.length === 0) return res.status(404).json({ error: 'Offer not found' });
    const offer = offerRows[0];

    // CRITICAL: Check if offer is still active (accepting applications)
    if (offer.status !== 'actif') {
      return res.status(403).json({ error: 'This offer is no longer accepting applications.' });
    }

    // Secondary check: Also verify deadline hasn't passed (backup validation)
    const now = new Date();
    const deadline = new Date(offer.deadline);
    if (now >= deadline) {
      return res.status(403).json({ error: 'Application deadline has passed. No applications are being accepted after the deadline.' });
    }

    // Check if user already applied to this offer
    const [existingApp] = await pool.query('SELECT id FROM applications WHERE offer_id = ? AND email = ?', [offer_id, email]);
    if (existingApp.length > 0) {
      return res.status(400).json({ error: 'You have already applied to this offer' });
    }

    // Check additional required files based on offer type
    const additionalRequiredFiles = [];
    if (['manifestation', 'appel_d_offre_service', 'appel_d_offre_equipement', 'consultation'].includes(offer.type)) {
      additionalRequiredFiles.push(
        'declaration_sur_honneur',
        'fiche_de_referencement',
        'extrait_registre',
        'note_methodologique',
        'liste_references',
        'offre_financiere'
      );
    }

    for (const fieldName of additionalRequiredFiles) {
      const file = getFileByFieldname(fieldName);
      if (!file) {
        return res.status(400).json({ error: `${fieldName} file is required for this offer type` });
      }
      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: `${fieldName} must be a PDF file` });
      }
    }

    // Prepare application data with filenames and filepaths
    const cvFile = getFileByFieldname('cv');
    const diplomeFile = getFileByFieldname('diplome');
    const idCardFile = getFileByFieldname('id_card');
    const coverLetterFile = getFileByFieldname('cover_letter');

    const applicationData = {
      offer_id,
      full_name,
      email,
      tel_number,
      applicant_country,
      cv_filename: cvFile.filename,
      cv_filepath: cvFile.path,
      diplome_filename: diplomeFile.filename,
      diplome_filepath: diplomeFile.path,
      id_card_filename: idCardFile.filename,
      id_card_filepath: idCardFile.path,
      cover_letter_filename: coverLetterFile.filename,
      cover_letter_filepath: coverLetterFile.path,
    };

    // Add additional files if they exist
    const additionalFields = [
      'declaration_sur_honneur', 'fiche_de_referencement', 'extrait_registre', 
      'note_methodologique', 'liste_references', 'offre_financiere'
    ];
    
    for (const fieldName of additionalFields) {
      const file = getFileByFieldname(fieldName);
      if (file) {
        applicationData[`${fieldName}_filename`] = file.filename;
        applicationData[`${fieldName}_filepath`] = file.path;
      }
    }
    
    // Collect custom documents and other documents
    const customDocuments = [];
    const otherDocuments = [];
    const processedFieldnames = new Set([
      'cv', 'diplome', 'id_card', 'cover_letter',
      'declaration_sur_honneur', 'fiche_de_referencement', 'extrait_registre',
      'note_methodologique', 'liste_references', 'offre_financiere'
    ]);

    if (files && Array.isArray(files)) {
      for (const file of files) {
        // Skip already processed standard files
        if (processedFieldnames.has(file.fieldname)) continue;

        // Check if it's an "other document"
        if (file.fieldname.startsWith('other_doc_')) {
          const index = file.fieldname.replace('other_doc_', '');
          const nameField = `other_doc_name_${index}`;
          const documentName = req.body[nameField] || `Document_${index}`;
          
          otherDocuments.push({
            name: documentName,
            filename: file.filename,
            filepath: file.path
          });
        } else {
          // It's a custom document
          customDocuments.push({
            key: file.fieldname,
            filename: file.filename,
            filepath: file.path
          });
        }
      }
    }

    // Insert application
    const [result] = await pool.query(`
      INSERT INTO applications
      (offer_id, full_name, email, tel_number, applicant_country, cv_filename, cv_filepath,
      diplome_filename, diplome_filepath, id_card_filename, id_card_filepath, cover_letter_filename, cover_letter_filepath,
      declaration_sur_honneur_filename, declaration_sur_honneur_filepath, fiche_de_referencement_filename, fiche_de_referencement_filepath,
      extrait_registre_filename, extrait_registre_filepath, note_methodologique_filename, note_methodologique_filepath,
      liste_references_filename, liste_references_filepath, offre_financiere_filename, offre_financiere_filepath)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationData.offer_id, applicationData.full_name, applicationData.email, applicationData.tel_number,
        applicationData.applicant_country, applicationData.cv_filename, applicationData.cv_filepath,
        applicationData.diplome_filename, applicationData.diplome_filepath, applicationData.id_card_filename, applicationData.id_card_filepath,
        applicationData.cover_letter_filename, applicationData.cover_letter_filepath,
        applicationData.declaration_sur_honneur_filename, applicationData.declaration_sur_honneur_filepath,
        applicationData.fiche_de_referencement_filename, applicationData.fiche_de_referencement_filepath,
        applicationData.extrait_registre_filename, applicationData.extrait_registre_filepath,
        applicationData.note_methodologique_filename, applicationData.note_methodologique_filepath,
        applicationData.liste_references_filename, applicationData.liste_references_filepath,
        applicationData.offre_financiere_filename, applicationData.offre_financiere_filepath
      ]
    );

    const applicationId = result.insertId;

    // Save custom documents to database
    if (customDocuments.length > 0) {
      for (const customDoc of customDocuments) {
        // Get the custom document ID from the custom_required_documents table
        const [customDocRows] = await pool.query(
          'SELECT id FROM custom_required_documents WHERE offer_id = ? AND document_key = ?',
          [offer_id, customDoc.key]
        );
        
        if (customDocRows.length > 0) {
          const customDocumentId = customDocRows[0].id;
          await pool.query(
            `INSERT INTO applicant_custom_documents (application_id, custom_document_id, document_name, file_path, file_size)
             VALUES (?, ?, ?, ?, ?)`,
            [applicationId, customDocumentId, customDoc.key, customDoc.filepath, 0]
          );
        }
      }
    }

    // Save other documents to database
    if (otherDocuments.length > 0) {
      for (const otherDoc of otherDocuments) {
        await pool.query(
          `INSERT INTO applicant_other_documents (application_id, document_name, file_path, file_size)
           VALUES (?, ?, ?, ?)`,
          [applicationId, otherDoc.name, otherDoc.filepath, 0]
        );
      }
    }

    // Get HR user (offer creator) info and send confirmation email
    const [hrRows] = await pool.query('SELECT name, email FROM users WHERE id = ?', [offer.created_by]);
    if (hrRows.length === 0) {
      console.warn('HR user not found for offer:', offer_id);
    } else {
      try {
        // Send email only to applicant
        await sendEmailWithGraphAPI(
          email,
          `Application Confirmation: ${offer.title}`,
          createApplicantConfirmationEmail(full_name, offer.title)
        );

        console.log('Application confirmation email sent successfully to applicant');
      } catch (emailError) {
        console.error('Error sending application confirmation email:', emailError.message);
        // Application was still saved successfully, just email failed
      }
    }

    console.log(`Application submitted successfully by ${full_name} for offer: ${offer.title}`);
    res.json({ id: applicationId, message: 'Application submitted successfully' });

  } catch (err) {
    console.error('Application submission error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── View Applications (RH only) ─────
// Get all applications with offer details and document download URLs
app.get('/applications', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    // For comite_ouverture, show all applications. For comite_ajout, show only applications from user's offers.
    const whereClause = req.user.role === 'comite_ouverture' ? '' : 'WHERE o.created_by = ?';
    const params = req.user.role === 'comite_ouverture' ? [] : [req.user.id];

    const [applications] = await pool.query(`
      SELECT
        a.id,
        a.offer_id,
        o.title AS offer_title,
        o.type AS offer_type,
        d.name AS offer_department,
        a.full_name,
        a.email,
        a.tel_number,
        a.applicant_country,
        a.created_at,
        a.cv_filename, a.cv_filepath,
        a.diplome_filename, a.diplome_filepath,
        a.id_card_filename, a.id_card_filepath,
        a.cover_letter_filename, a.cover_letter_filepath,
        a.declaration_sur_honneur_filename, a.declaration_sur_honneur_filepath,
        a.fiche_de_referencement_filename, a.fiche_de_referencement_filepath,
        a.extrait_registre_filename, a.extrait_registre_filepath,
        a.note_methodologique_filename, a.note_methodologique_filepath,
        a.liste_references_filename, a.liste_references_filepath,
        a.offre_financiere_filename, a.offre_financiere_filepath
      FROM applications a
      JOIN offers o ON a.offer_id = o.id
      LEFT JOIN departments d ON o.department_id = d.id
      ${whereClause}
      ORDER BY a.created_at DESC
    `, params);

    // Add document download URLs to each application
    const applicationsWithUrls = applications.map(app => ({
      ...app,
      cv_url: `/applications/${app.id}/cv`,
      diplome_url: `/applications/${app.id}/diplome`,
      id_card_url: `/applications/${app.id}/id_card`,
      cover_letter_url: `/applications/${app.id}/cover_letter`,
      declaration_sur_honneur_url: app.declaration_sur_honneur_filename ? `/applications/${app.id}/declaration_sur_honneur` : null,
      fiche_de_referencement_url: app.fiche_de_referencement_filename ? `/applications/${app.id}/fiche_de_referencement` : null,
      extrait_registre_url: app.extrait_registre_filename ? `/applications/${app.id}/extrait_registre` : null,
      note_methodologique_url: app.note_methodologique_filename ? `/applications/${app.id}/note_methodologique` : null,
      liste_references_url: app.liste_references_filename ? `/applications/${app.id}/liste_references` : null,
      offre_financiere_url: app.offre_financiere_filename ? `/applications/${app.id}/offre_financiere` : null
    }));

    res.json(applicationsWithUrls);
  } catch (err) {
    console.error('Error fetching applications:', err);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Get application counts by offer (for summary view)
app.get('/applications/summary', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    // Use server local time for consistent comparison
    const now = getLocalDate();
    
    // First, update any expired offers from actif to sous_evaluation
    // Use Tunisia time comparison directly
    await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);
    
    // For comite_ouverture, show all offers. For comite_ajout, show only user's offers.
    const whereClause = req.user.role === 'comite_ouverture' ? '' : 'WHERE o.created_by = ?';
    const params = req.user.role === 'comite_ouverture' ? [] : [req.user.id];

    const [summary] = await pool.query(`
      SELECT
        o.id as offer_id,
        o.title as offer_title,
        o.type as offer_type,
        d.name as offer_department,
        p.name as offer_project,
        o.deadline,
        COUNT(a.id) as application_count,
        CASE
          WHEN o.deadline <= ? THEN 'expired'
          ELSE 'active'
        END as offer_status,
        CASE
          WHEN o.deadline <= ? THEN
            CASE
              WHEN TIMESTAMPDIFF(HOUR, o.deadline, ?) <= 336 THEN 'archive_window_open' -- 14 days = 336 hours
              ELSE 'archive_window_closed'
            END
          ELSE 'active'
        END as archive_window_status,
        TIMESTAMPDIFF(HOUR, o.deadline, ?) as hours_since_expiry,
        o.status,
        o.winner_name
      FROM offers o
      LEFT JOIN applications a ON o.id = a.offer_id
      LEFT JOIN projects p ON o.project_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      ${whereClause}
      GROUP BY o.id, o.title, o.type, d.name, p.name, o.deadline, o.status, o.winner_name
      ORDER BY o.deadline ASC
    `, [now, now, now, now, ...params]);

    res.json(summary);
  } catch (err) {
    console.error('Error fetching application summary:', err);
    res.status(500).json({ error: 'Failed to fetch application summary' });
  }
});

// Archive applications for an expired offer
app.post('/applications/archive/:offerId', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { offerId } = req.params;
    
    // Use Tunisia time for consistent comparison
    const now = getLocalDate();

    // For comite_ouverture, verify the offer exists and is expired (any offer)
    // For comite_ajout, verify the offer belongs to the user and is expired
    const whereClause = req.user.role === 'comite_ouverture'
      ? 'WHERE id = ? AND deadline <= ?'
      : 'WHERE id = ? AND created_by = ? AND deadline <= ?';
    const params = req.user.role === 'comite_ouverture'
      ? [offerId, now]
      : [offerId, req.user.id, now];

    const [offerCheck] = await pool.query(`
      SELECT id, title, deadline, TIMESTAMPDIFF(HOUR, deadline, ?) as hours_since_expiry FROM offers
      ${whereClause}
    `, [now, ...params]);

    if (offerCheck.length === 0) {
      return res.status(404).json({ error: 'Offer not found, not expired, or not authorized' });
    }

    const offer = offerCheck[0];

    // Check if offer is within the 2-week archive window (14 days = 336 hours)
    if (offer.hours_since_expiry > 336) {
      return res.status(400).json({
        error: 'Archive window closed',
        message: 'This offer expired more than 2 weeks ago and can no longer be archived.'
      });
    }

    // Get all applications for this offer (both archived and non-archived)
    const [applications] = await pool.query(`
      SELECT * FROM applications WHERE offer_id = ?
    `, [offerId]);

    if (applications.length === 0) {
      return res.status(404).json({ error: 'No applications found for this offer' });
    }

    // Get only non-archived applications count for logging
    const [nonArchivedApps] = await pool.query(`
      SELECT COUNT(*) as count FROM applications WHERE offer_id = ? AND archived_at IS NULL
    `, [offerId]);
    
    const nonArchivedCount = nonArchivedApps[0].count;

    // Create a zip file with all applications
    const JSZip = require('jszip');
    const zip = new JSZip();

    for (const app of applications) {
      // Create folder structure: OfferTitle/CandidateName/
      const folderName = `${offer.title.replace(/[^a-zA-Z0-9]/g, '_')}/${app.full_name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Add each document if it exists
      const documents = [
        { filename: app.cv_filename, filepath: app.cv_filepath, type: 'CV' },
        { filename: app.diplome_filename, filepath: app.diplome_filepath, type: 'Diploma' },
        { filename: app.id_card_filename, filepath: app.id_card_filepath, type: 'ID_Card' },
        { filename: app.cover_letter_filename, filepath: app.cover_letter_filepath, type: 'Cover_Letter' },
        { filename: app.declaration_sur_honneur_filename, filepath: app.declaration_sur_honneur_filepath, type: 'Declaration_Honneur' },
        { filename: app.fiche_de_referencement_filename, filepath: app.fiche_de_referencement_filepath, type: 'Fiche_Referencement' },
        { filename: app.extrait_registre_filename, filepath: app.extrait_registre_filepath, type: 'Extrait_Registre' },
        { filename: app.note_methodologique_filename, filepath: app.note_methodologique_filepath, type: 'Note_Methodologique' },
        { filename: app.liste_references_filename, filepath: app.liste_references_filepath, type: 'Liste_References' },
        { filename: app.offre_financiere_filename, filepath: app.offre_financiere_filepath, type: 'Offre_Financiere' }
      ];

      for (const doc of documents) {
        if (doc.filename && doc.filepath && fs.existsSync(doc.filepath)) {
          try {
            const fileData = fs.readFileSync(doc.filepath);
            const fileExtension = doc.filename.split('.').pop();
            const cleanFilename = `${doc.type}.${fileExtension}`;
            zip.file(`${folderName}/${cleanFilename}`, fileData);
          } catch (error) {
            console.error(`Error reading ${doc.type} for ${app.full_name}:`, error);
          }
        }
      }

      // Get other documents for this application
      const [otherDocs] = await pool.query(
        'SELECT document_name, file_path FROM applicant_other_documents WHERE application_id = ?',
        [app.id]
      );

      for (const otherDoc of otherDocs) {
        if (otherDoc.file_path && fs.existsSync(otherDoc.file_path)) {
          try {
            const fileData = fs.readFileSync(otherDoc.file_path);
            const fileExtension = otherDoc.file_path.split('.').pop();
            const cleanFilename = `Other_${otherDoc.document_name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
            zip.file(`${folderName}/${cleanFilename}`, fileData);
          } catch (error) {
            console.error(`Error reading other document ${otherDoc.document_name} for ${app.full_name}:`, error);
          }
        }
      }

      // Get custom documents for this application
      const [customDocs] = await pool.query(
        `SELECT acd.document_name, acd.file_path, crd.document_key 
         FROM applicant_custom_documents acd
         JOIN custom_required_documents crd ON acd.custom_document_id = crd.id
         WHERE acd.application_id = ?`,
        [app.id]
      );

      for (const customDoc of customDocs) {
        if (customDoc.file_path && fs.existsSync(customDoc.file_path)) {
          try {
            const fileData = fs.readFileSync(customDoc.file_path);
            const fileExtension = customDoc.file_path.split('.').pop();
            const cleanFilename = `Custom_${customDoc.document_name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
            zip.file(`${folderName}/${cleanFilename}`, fileData);
          } catch (error) {
            console.error(`Error reading custom document ${customDoc.document_name} for ${app.full_name}:`, error);
          }
        }
      }

      // Add a summary text file for each candidate
      const totalDocs = documents.filter(d => d.filename && d.filepath && fs.existsSync(d.filepath)).length + otherDocs.length + customDocs.length;
      const summaryText = `
Candidate Information:
- Name: ${app.full_name}
- Email: ${app.email}
- Phone: ${app.tel_number}
- Country: ${app.applicant_country}
- Applied for: ${offer.title}
- Offer Type: ${offer.type}
- Department: ${offer.department || 'N/A'}
- Application Date: ${new Date(app.created_at).toLocaleDateString()}
- Total Documents: ${totalDocs}
`;
      zip.file(`${folderName}/candidate_info.txt`, summaryText);
    }

    // Generate the zip file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create a unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: YYYY-MM-DDTHH-mm-ss
    const archiveFilename = `archived_applications_${offer.title.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.zip`;
    const archivePath = `./archives/${archiveFilename}`;

    // Ensure archives directory exists
    if (!fs.existsSync('./archives')) {
      fs.mkdirSync('./archives', { recursive: true });
    }

    // Save the zip file
    fs.writeFileSync(archivePath, zipBuffer);

    // Mark only non-archived applications as archived (leave previously archived ones untouched)
    if (nonArchivedCount > 0) {
      await pool.query('UPDATE applications SET archived_at = NOW() WHERE offer_id = ? AND archived_at IS NULL', [offerId]);
    }

    // Log the action
    logAction(`${req.user.name} (${req.user.email}) archived ${applications.length} applications (${nonArchivedCount} newly archived) for offer "${offer.title}"`);

    res.json({
      message: `Successfully archived ${applications.length} applications for offer "${offer.title}"`,
      archiveFile: archiveFilename,
      applicationsCount: applications.length,
      newlyArchivedCount: nonArchivedCount,
      allowReArchive: nonArchivedCount > 0
    });

  } catch (err) {
    console.error('Error archiving applications:', err);
    res.status(500).json({ error: 'Failed to archive applications' });
  }
});

// Download archived applications file
app.get('/applications/archive/:filename', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = `./archives/${filename}`;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));

  } catch (err) {
    console.error('Error downloading archive:', err);
    res.status(500).json({ error: 'Failed to download archive' });
  }
});

// Download documents for a specific application
app.get('/applications/:id/:documentType', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { id, documentType } = req.params;

    // Validate document type
    const validDocumentTypes = [
      'cv', 'diplome', 'id_card', 'cover_letter',
      'declaration_sur_honneur', 'fiche_de_referencement',
      'extrait_registre', 'note_methodologique',
      'liste_references', 'offre_financiere'
    ];

    if (!validDocumentTypes.includes(documentType)) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    const [rows] = await pool.query(
      `SELECT ${documentType}_filename, ${documentType}_filepath FROM applications WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });

    const filename = rows[0][`${documentType}_filename`];
    const filepath = rows[0][`${documentType}_filepath`];

    if (!filename || !filepath) return res.status(404).json({ error: 'Document not found' });

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filepath);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ───── Check for expired offers ─────
async function checkExpiredOffers() {
  try {
    const now = getLocalDate(); // Use Tunisia time
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Format dates for comparison (DATETIME format) - using Tunisia time
    const nowStr = getLocalTime();
    
    // Check for offers expiring in the next 24 hours (1 day warning) - haven't been notified for 1-day warning
    const [expiringTomorrowOffers] = await pool.query(`
      SELECT o.*, u.name as hr_name, u.email as hr_email
      FROM offers o
      JOIN users u ON o.created_by = u.id
      WHERE o.deadline <= ? AND o.deadline > ? AND (o.one_day_notified IS NULL OR o.one_day_notified = FALSE)
    `, [tomorrow, now]);

    for (const offer of expiringTomorrowOffers) {
      try {
        // Send 1-day expiration warning notifications
        let notificationEmails = [];
        if (offer.notification_emails) {
          try {
            notificationEmails = JSON.parse(offer.notification_emails);
          } catch (e) {
            console.error('Error parsing notification emails for offer', offer.id, ':', e.message);
          }
        }

        // Add HR creator email to the notification list if not already included
        if (offer.hr_email && !notificationEmails.includes(offer.hr_email)) {
          notificationEmails.unshift(offer.hr_email); // Add HR email first
        }

        if (notificationEmails.length > 0) {
          for (const email of notificationEmails) {
            try {
              const isHR = email === offer.hr_email;
              const recipientName = isHR ? offer.hr_name : 'Notification Recipient';

              await sendEmailWithGraphAPI(
                email,
                `Offer Expiring Tomorrow: ${offer.title}`,
                createUpcomingExpirationNotificationEmail(recipientName, offer.title, offer.deadline, 1)
              );

              const recipientType = isHR ? 'HR creator' : 'notification email';
              logAction(`System sent 1-day expiration warning for offer "${offer.title}" to ${email} (${recipientType})`);
            } catch (emailError) {
              console.error(`Failed to send 1-day warning email to ${email} for offer ${offer.title}:`, emailError.message);
            }
          }
        }
        // Mark as notified for 1-day warning
        await pool.query('UPDATE offers SET one_day_notified = TRUE WHERE id = ?', [offer.id]);

        logAction(`System processed 1-day warning for offer "${offer.title}" with ${notificationEmails.length} notification emails`);

      } catch (error) {
        console.error(`Error processing 1-day warning for offer ${offer.title}:`, error.message);
      }
    }

    // Check for offers expiring in the next 48 hours (2 day warning) - haven't been notified for 2-day warning
    const [expiringInTwoDaysOffers] = await pool.query(`
      SELECT o.*, u.name as hr_name, u.email as hr_email
      FROM offers o
      JOIN users u ON o.created_by = u.id
      WHERE o.deadline <= ? AND o.deadline > ? AND (o.two_day_notified IS NULL OR o.two_day_notified = FALSE)
    `, [twoDaysFromNow, tomorrow]);

    for (const offer of expiringInTwoDaysOffers) {
      try {
        // Send 2-day expiration warning notifications
        let notificationEmails = [];
        if (offer.notification_emails) {
          try {
            notificationEmails = JSON.parse(offer.notification_emails);
          } catch (e) {
            console.error('Error parsing notification emails for offer', offer.id, ':', e.message);
          }
        }

        // Add HR creator email to the notification list if not already included
        if (offer.hr_email && !notificationEmails.includes(offer.hr_email)) {
          notificationEmails.unshift(offer.hr_email); // Add HR email first
        }

        if (notificationEmails.length > 0) {
          for (const email of notificationEmails) {
            try {
              const isHR = email === offer.hr_email;
              const recipientName = isHR ? offer.hr_name : 'Notification Recipient';

              await sendEmailWithGraphAPI(
                email,
                `Offer Expiring in 2 Days: ${offer.title}`,
                createUpcomingExpirationNotificationEmail(recipientName, offer.title, offer.deadline, 2)
              );

              const recipientType = isHR ? 'HR creator' : 'notification email';
              logAction(`System sent 2-day expiration warning for offer "${offer.title}" to ${email} (${recipientType})`);
            } catch (emailError) {
              console.error(`Failed to send 2-day warning email to ${email} for offer ${offer.title}:`, emailError.message);
            }
          }
        }
        // Mark as notified for 2-day warning
        await pool.query('UPDATE offers SET two_day_notified = TRUE WHERE id = ?', [offer.id]);

        logAction(`System processed 2-day warning for offer "${offer.title}" with ${notificationEmails.length} notification emails`);

      } catch (error) {
        console.error(`Error processing 2-day warning for offer ${offer.title}:`, error.message);
      }
    }

    // Check for already expired offers (post-expiration notification)
    const [expiredOffers] = await pool.query(`
      SELECT o.*, u.name as hr_name, u.email as hr_email
      FROM offers o
      JOIN users u ON o.created_by = u.id
      WHERE o.deadline < ? AND (o.deadline_notified IS NULL OR o.deadline_notified = FALSE)
    `, [now]);

    for (const offer of expiredOffers) {
      try {
        // Send email notifications using the notification_emails field AND HR creator
        let notificationEmails = [];
        if (offer.notification_emails) {
          try {
            notificationEmails = JSON.parse(offer.notification_emails);
          } catch (e) {
            console.error('Error parsing notification emails for offer', offer.id, ':', e.message);
          }
        }

        // Add HR creator email to the notification list if not already included
        if (offer.hr_email && !notificationEmails.includes(offer.hr_email)) {
          notificationEmails.unshift(offer.hr_email); // Add HR email first
        }

        if (notificationEmails.length > 0) {
          for (const email of notificationEmails) {
            try {
              // Personalize the email for HR vs other recipients
              const isHR = email === offer.hr_email;
              const recipientName = isHR ? offer.hr_name : 'Notification Recipient';

              await sendEmailWithGraphAPI(
                email,
                `Offer Expired: ${offer.title}`,
                createExpirationNotificationEmail(recipientName, offer.title, offer.deadline)
              );

              // Log action
              const recipientType = isHR ? 'HR creator' : 'notification email';
              logAction(`System sent expiration notification for offer "${offer.title}" to ${email} (${recipientType})`);
            } catch (emailError) {
              console.error(`Failed to send expiration email to ${email} for offer ${offer.title}:`, emailError.message);
            }
          }
        }
        // Mark as notified
        await pool.query('UPDATE offers SET deadline_notified = TRUE WHERE id = ?', [offer.id]);

        // Log action
        logAction(`System processed expired offer "${offer.title}" with ${notificationEmails.length} notification emails`);

      } catch (error) {
        console.error(`Error processing expired offer ${offer.title}:`, error.message);
      }
    }

    // Update status of expired offers from 'actif' to 'sous_evaluation'
    const [expiredActiveOffers] = await pool.query(`
      SELECT id, title 
      FROM offers 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);

    for (const offer of expiredActiveOffers) {
      try {
        await pool.query('UPDATE offers SET status = ? WHERE id = ?', ['sous_evaluation', offer.id]);
        logAction(`System automatically changed offer "${offer.title}" status from 'actif' to 'sous_evaluation' due to expired deadline`);
        console.log(`Offer "${offer.title}" (ID: ${offer.id}) status changed to 'sous_evaluation'`);
      } catch (error) {
        console.error(`Error updating status for expired offer ${offer.title}:`, error.message);
      }
    }

    if (expiredActiveOffers.length > 0) {
      console.log(`Updated ${expiredActiveOffers.length} offers from 'actif' to 'sous_evaluation'`);
    }

  } catch (err) {
    console.error('Error checking expired offers:', err);
  }
}

// Test email endpoint for Microsoft Graph API
app.post('/test-email', auth, requireRole('admin'), async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, message' });
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #343a40; margin: 0;">Test Email</h2>
        </div>

        <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
          <p style="color: #495057; font-size: 16px;">Hello,</p>

          <p style="color: #495057; font-size: 14px;">
            ${message}
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; margin: 0;">
              This is a test email sent via Microsoft Graph API<br>
              Sent by: ${req.user.name} (${req.user.email})<br>
              Time: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `;

    await sendEmailWithGraphAPI(to, subject, htmlContent);

    logAction(`${req.user.name} (${req.user.email}) sent test email to ${to}`);
    res.json({ message: 'Test email sent successfully via Microsoft Graph API' });

  } catch (err) {
    console.error('Test email error:', err);
    res.status(500).json({ error: 'Failed to send test email: ' + err.message });
  }
});

// ───── Q&A API Endpoints ─────

// Submit a question for an offer
app.post('/offers/:id/questions', async (req, res) => {
  try {
    const { id } = req.params;
    const { question } = req.body;
    
    if (!question || question.trim() === '') {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    // Check if offer exists and is active
    const [offers] = await pool.query('SELECT status, deadline FROM offers WHERE id = ?', [id]);
    if (offers.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    const offer = offers[0];
    
    // Check if offer is still active (not expired and status is 'actif')
    const now = new Date();
    const deadline = new Date(offer.deadline);
    
    if (offer.status !== 'actif' || deadline < now) {
      return res.status(400).json({ error: 'Questions can only be submitted for active offers' });
    }
    
    // Insert the question
    const [result] = await pool.query(
      'INSERT INTO questions (offer_id, question) VALUES (?, ?)',
      [id, question.trim()]
    );
    
    res.status(201).json({ 
      message: 'Question submitted successfully',
      questionId: result.insertId 
    });
    
  } catch (err) {
    console.error('Submit question error:', err);
    res.status(500).json({ error: 'Failed to submit question: ' + err.message });
  }
});

// Get all questions for an offer (for committee)
app.get('/offers/:id/questions', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current server local time for real-time status checking
    const now = getLocalDate();
    
    // First, update any expired offers from actif to sous_evaluation
    // Use Tunisia time comparison directly
    await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);
    
    // Check if offer exists
    const [offers] = await pool.query('SELECT status, deadline FROM offers WHERE id = ?', [id]);
    if (offers.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    const offer = offers[0];
    
    // Get all questions for this offer
    const [questions] = await pool.query(
      'SELECT id, question, answer, created_at, answered_at FROM questions WHERE offer_id = ? ORDER BY created_at DESC',
      [id]
    );
    
    res.json(questions);
    
  } catch (err) {
    console.error('Get questions error:', err);
    res.status(500).json({ error: 'Failed to get questions: ' + err.message });
  }
});

// Answer a question
app.put('/questions/:id/answer', auth, requireRole(['comite_ajout', 'comite_ouverture']), async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    
    if (!answer || answer.trim() === '') {
      return res.status(400).json({ error: 'Answer is required' });
    }
    
    // Get the question and check if the offer is still active
    const [questions] = await pool.query(
      `SELECT q.*, o.status as offer_status, o.deadline 
       FROM questions q 
       JOIN offers o ON q.offer_id = o.id 
       WHERE q.id = ?`,
      [id]
    );
    
    if (questions.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    const question = questions[0];
    
    // Check if offer is still active
    const now = new Date();
    const deadline = new Date(question.deadline);
    
    if (question.offer_status !== 'actif' || deadline < now) {
      return res.status(400).json({ error: 'Questions can only be answered for active offers' });
    }
    
    // Update the question with the answer
    await pool.query(
      'UPDATE questions SET answer = ?, answered_at = CURRENT_TIMESTAMP WHERE id = ?',
      [answer.trim(), id]
    );
    
    res.json({ message: 'Answer submitted successfully' });
    
  } catch (err) {
    console.error('Answer question error:', err);
    res.status(500).json({ error: 'Failed to answer question: ' + err.message });
  }
});

// Update expired status for a specific offer (called by frontend when timer hits zero)
app.post('/offers/:id/update-expired-status', async (req, res) => {
  try {
    const { id } = req.params;
    const now = getLocalDate();
    
    // Update this specific offer if expired
    // Use Tunisia time comparison directly
    const [result] = await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE id = ? AND deadline < ? AND status = 'actif'
    `, [id, now]);
    
    if (result.affectedRows > 0) {
      logAction(`System automatically changed offer ID ${id} status from 'actif' to 'sous_evaluation' due to expired deadline (timer trigger)`);
      console.log(`Offer ID ${id} status changed to 'sous_evaluation' via timer trigger`);
    }
    
    res.json({ 
      success: true, 
      message: result.affectedRows > 0 ? 'Status updated' : 'No update needed',
      updated: result.affectedRows > 0
    });
  } catch (err) {
    console.error('Error updating expired status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get FAQ (answered questions) for an offer
app.get('/offers/:id/faq', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get current server local time for real-time status checking
    const now = getLocalDate();
    
    // First, update any expired offers from actif to sous_evaluation
    // Use Tunisia time comparison directly
    await pool.query(`
      UPDATE offers 
      SET status = 'sous_evaluation' 
      WHERE deadline < ? AND status = 'actif'
    `, [now]);
    
    // Check if offer exists
    const [offers] = await pool.query('SELECT id FROM offers WHERE id = ?', [id]);
    if (offers.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }
    
    // Get answered questions for this offer
    const [questions] = await pool.query(
      'SELECT question, answer FROM questions WHERE offer_id = ? AND answer IS NOT NULL ORDER BY answered_at DESC',
      [id]
    );
    
    res.json(questions);
    
  } catch (err) {
    console.error('Get FAQ error:', err);
    res.status(500).json({ error: 'Failed to get FAQ: ' + err.message });
  }
});

// ───── Start Server ─────
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Email service: Microsoft Graph API with Outlook');
  console.log(`Email account: ${OUTLOOK_CONFIG.userEmail}`);
});