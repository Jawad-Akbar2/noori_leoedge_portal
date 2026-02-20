import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';

// Generic auth - gets role from token
async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    req.userId = decoded.id;
    req.role = decoded.role || (user.department === 'Manager' ? 'admin' : 'employee');
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Admin-only endpoints
async function adminAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Enforce: Must be admin
    const role = decoded.role || (user.department === 'Manager' ? 'admin' : 'employee');
    
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    req.userId = decoded.id;
    req.role = role;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Employee-only endpoints
async function employeeAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Employee.findById(decoded.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Enforce: Must be employee and active
    const role = decoded.role || (user.department === 'Manager' ? 'admin' : 'employee');
    
    if (role !== 'employee' || user.status !== 'Active') {
      return res.status(403).json({ message: 'Employee access required' });
    }

    req.user = user;
    req.userId = decoded.id;
    req.role = role;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
}

export { auth, adminAuth, employeeAuth };
export default auth;